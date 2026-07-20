//! CEF offscreen rendering (OSR) viewport — spike (`spike/cef-osr`).
//!
//! Why this exists: both existing viewport surfaces are dead ends. An iframe
//! dies on X-Frame-Options/CSP/frame-busting; a native child webview dies on
//! airspace (it composites above all HTML, so Radix overlays land underneath).
//! CEF OSR escapes both: Chromium renders the page into a buffer here, the
//! frames are shipped to the frontend, and the page is drawn into a `<canvas>`
//! that lives in the normal DOM.
//!
//! Linux x86_64 only for the spike. macOS needs helper-process app bundling
//! (out of scope; see spike-notes.md).
//!
//! ## Unsafe
//!
//! All unsafe in the CEF integration is confined to this module. cef-rs's
//! `wrap_*!` macros generate the refcount plumbing, so the unsafe here is
//! limited to the two raw-pointer facts CEF's C API forces on us:
//!
//! 1. `execute_process`/`initialize` take a `*mut u8` Windows sandbox-info
//!    pointer. On Linux it is required to be null.
//! 2. `on_paint` hands us a `*const u8` BGRA buffer owned by CEF, valid only
//!    for the duration of the call.
//! 3. Linux CEF requires Xlib threading initialized before either CEF or GTK
//!    touches X11.
//!
//! ## Threading invariants
//!
//! - `execute_subprocess` MUST be the first thing `main` does, before any
//!   thread is spawned. CEF forks a zygote on Linux; forking a process that
//!   already has threads is undefined behaviour.
//! - `init`, CEF message-loop work, browser callbacks, and `shutdown` all run
//!   on the GTK main thread. This avoids racing GTK's process-global state.

use cef::{args::Args, *};
use serde::Deserialize;
use std::cell::{Cell, RefCell};
use std::path::{Path, PathBuf};
use std::rc::Rc;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::ipc::{Channel, InvokeResponseBody};

#[link(name = "X11")]
extern "C" {
    fn XInitThreads() -> ::std::os::raw::c_int;
}

const TARGET_FRAME_RATE: i32 = 60;
const FRAME_VERSION: u32 = 1;
const FRAME_HEADER_BYTES: usize = 24;
const RECT_HEADER_BYTES: usize = 16;
const BYTES_PER_PIXEL: usize = 4;
const MAX_DEVICE_SCALE_FACTOR: f64 = 8.0;
const CEF_CACHE_DIR: &str = "com.tslater.polyui/cef";
const CEF_ENABLED_FILE: &str = "com.tslater.polyui/cef-enabled";
const CEF_LOCALE: &str = "en-US";
/// Keep Chromium's HTTP cache bounded; page storage/cookies are separate.
const CEF_DISK_CACHE_BYTES: &str = "67108864";

fn browser_switches() -> [&'static str; 2] {
    ["disable-gpu", "disable-gpu-compositing"]
}

fn browser_switch_values() -> [(&'static str, &'static str); 1] {
    [("disk-cache-size", CEF_DISK_CACHE_BYTES)]
}

/// Set once `initialize` succeeds, so `shutdown` cannot run against an
/// uninitialized CEF (which aborts inside Chromium) and cannot run twice.
static INITIALIZED: AtomicBool = AtomicBool::new(false);
static PUMP_GENERATION: AtomicU64 = AtomicU64::new(0);

struct BrowserState {
    browser: Browser,
    width: Rc<Cell<i32>>,
    height: Rc<Cell<i32>>,
    scale_factor: Rc<Cell<f32>>,
    full_frame_pending: Rc<Cell<bool>>,
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CefMouseButton {
    Left,
    Middle,
    Right,
}

#[derive(Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum CefKeyEventType {
    RawKeyDown,
    KeyUp,
    Char,
}

#[derive(Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "snake_case",
    rename_all_fields = "camelCase"
)]
pub enum CefInputEvent {
    Focus {
        focused: bool,
    },
    MouseMove {
        x: i32,
        y: i32,
        modifiers: u32,
        mouse_leave: bool,
    },
    MouseClick {
        x: i32,
        y: i32,
        modifiers: u32,
        button: CefMouseButton,
        mouse_up: bool,
        click_count: u8,
    },
    MouseWheel {
        x: i32,
        y: i32,
        modifiers: u32,
        delta_x: i32,
        delta_y: i32,
    },
    Key {
        event_type: CefKeyEventType,
        modifiers: u32,
        windows_key_code: i32,
        native_key_code: i32,
        is_system_key: bool,
        character: u16,
        unmodified_character: u16,
    },
}

thread_local! {
    static BROWSER: RefCell<Option<BrowserState>> = const { RefCell::new(None) };
}

type CefUiJob = Box<dyn FnOnce() + Send + 'static>;

cef::wrap_task! {
    struct CefUiTask {
        job: Arc<Mutex<Option<CefUiJob>>>,
    }

    impl Task {
        fn execute(&self) {
            let job = match self.job.lock() {
                Ok(mut slot) => slot.take(),
                Err(poisoned) => poisoned.into_inner().take(),
            };
            if let Some(job) = job {
                job();
            }
        }
    }
}

cef::wrap_browser_process_handler! {
    struct OsrBrowserProcessHandler;

    impl BrowserProcessHandler {
        fn on_schedule_message_pump_work(&self, delay_ms: i64) {
            schedule_message_pump(delay_ms);
        }
    }
}

cef::wrap_app! {
    struct OsrApp;

    impl App {
        fn browser_process_handler(&self) -> Option<BrowserProcessHandler> {
            Some(OsrBrowserProcessHandler::new())
        }

        fn on_before_command_line_processing(
            &self,
            _process_type: Option<&CefString>,
            command_line: Option<&mut CommandLine>,
        ) {
            if let Some(command_line) = command_line {
                for switch in browser_switches() {
                    let switch: CefString = switch.into();
                    command_line.append_switch(Some(&switch));
                }
                for (name, value) in browser_switch_values() {
                    let name: CefString = name.into();
                    let value: CefString = value.into();
                    command_line.append_switch_with_value(Some(&name), Some(&value));
                }
            }
        }
    }
}

cef::wrap_render_handler! {
    struct OsrRenderHandler {
        width: Rc<Cell<i32>>,
        height: Rc<Cell<i32>>,
        scale_factor: Rc<Cell<f32>>,
        full_frame_pending: Rc<Cell<bool>>,
        on_frame: Channel<InvokeResponseBody>,
    }

    impl RenderHandler {
        fn view_rect(&self, _browser: Option<&mut Browser>, rect: Option<&mut Rect>) {
            if let Some(rect) = rect {
                rect.width = self.width.get();
                rect.height = self.height.get();
            }
        }

        fn screen_info(
            &self,
            _browser: Option<&mut Browser>,
            screen_info: Option<&mut ScreenInfo>,
        ) -> ::std::os::raw::c_int {
            if let Some(screen_info) = screen_info {
                screen_info.device_scale_factor = self.scale_factor.get();
                return 1;
            }
            0
        }

        fn on_paint(
            &self,
            _browser: Option<&mut Browser>,
            type_: PaintElementType,
            dirty_rects: Option<&[Rect]>,
            buffer: *const u8,
            width: ::std::os::raw::c_int,
            height: ::std::os::raw::c_int,
        ) {
            if type_ != PaintElementType::VIEW || buffer.is_null() || width <= 0 || height <= 0 {
                return;
            }
            let Some(byte_len) = (width as usize)
                .checked_mul(height as usize)
                .and_then(|pixels| pixels.checked_mul(BYTES_PER_PIXEL))
            else {
                return;
            };
            // SAFETY: CEF owns this BGRA buffer and guarantees width * height
            // * 4 readable bytes for this callback only. `encode_frame` copies
            // every selected byte before the callback returns.
            let pixels = unsafe { std::slice::from_raw_parts(buffer, byte_len) };
            let full_frame = [Rect { x: 0, y: 0, width, height }];
            let rects = if self.full_frame_pending.replace(false) {
                &full_frame
            } else {
                dirty_rects.filter(|rects| !rects.is_empty()).unwrap_or(&full_frame)
            };
            let painted_at_ms = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map(|duration| duration.as_secs_f64() * 1_000.0)
                .unwrap_or_default();
            if let Ok(packet) = encode_frame(pixels, width, height, rects, painted_at_ms) {
                let _ = self.on_frame.send(InvokeResponseBody::Raw(packet));
            }
        }
    }
}

cef::wrap_display_handler! {
    struct OsrDisplayHandler {
        on_cursor: Channel<String>,
        on_address: Channel<String>,
    }

    impl DisplayHandler {
        fn on_cursor_change(
            &self,
            _browser: Option<&mut Browser>,
            _cursor: ::std::os::raw::c_ulong,
            type_: CursorType,
            _custom_cursor_info: Option<&CursorInfo>,
        ) -> ::std::os::raw::c_int {
            let _ = self.on_cursor.send(cursor_css(type_).to_string());
            1
        }

        fn on_address_change(
            &self,
            _browser: Option<&mut Browser>,
            frame: Option<&mut Frame>,
            url: Option<&CefString>,
        ) {
            let is_main_frame = frame.is_some_and(|frame| frame.is_main() != 0);
            if let Some(url) = url.filter(|_| is_main_frame) {
                let _ = self.on_address.send(url.to_string());
            }
        }
    }
}

cef::wrap_client! {
    struct OsrClient {
        render_handler: RenderHandler,
        display_handler: DisplayHandler,
    }

    impl Client {
        fn render_handler(&self) -> Option<RenderHandler> {
            Some(self.render_handler.clone())
        }

        fn display_handler(&self) -> Option<DisplayHandler> {
            Some(self.display_handler.clone())
        }
    }
}

/// Runs the CEF subprocess entry point.
///
/// CEF re-executes *this same binary* for its render/GPU/zygote/utility
/// processes, distinguishing them by `--type=` on the command line. In those
/// processes this call blocks until that subprocess is done and returns its
/// exit code; in the browser process it returns `None` immediately and startup
/// continues into Tauri.
///
/// Must be called before anything else in `main` — see module threading
/// invariants.
pub fn execute_subprocess() -> Option<i32> {
    initialize_api_version();
    let args = Args::new();
    // SAFETY: the third argument is Windows sandbox info; CEF requires null on
    // every other platform. `None` for the app: the spike registers no custom
    // process handlers, so the subprocesses need no Rust-side callbacks.
    let code = cef::execute_process(Some(args.as_main_args()), None, std::ptr::null_mut());
    // >= 0 means "this process was a CEF subprocess and has finished".
    // -1 means "this is the browser process, carry on".
    (code >= 0).then_some(code)
}

fn initialize_api_version() {
    let _ = cef::api_hash(cef::sys::CEF_API_VERSION_LAST, 0);
}

fn enabled_path() -> Result<PathBuf, String> {
    dirs::config_dir()
        .map(|path| path.join(CEF_ENABLED_FILE))
        .ok_or_else(|| "OS config directory is unavailable.".to_string())
}

pub fn enabled_on_next_start() -> bool {
    enabled_path().is_ok_and(|path| path.is_file())
}

fn set_enabled_at(path: &Path, enabled: bool) -> Result<(), String> {
    if enabled {
        let parent = path
            .parent()
            .ok_or_else(|| "CEF preference path has no parent directory.".to_string())?;
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
        return std::fs::write(path, b"enabled").map_err(|error| error.to_string());
    }

    match std::fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
pub fn cef_viewport_set_enabled(enabled: bool) -> Result<(), String> {
    set_enabled_at(&enabled_path()?, enabled)
}

#[tauri::command]
pub fn cef_viewport_is_enabled() -> bool {
    enabled_on_next_start()
}

/// Initializes CEF in the browser process. Main thread only.
pub fn init() -> Result<(), String> {
    prepare_linux_threading()?;
    let args = Args::new();
    let cache_path = dirs::cache_dir()
        .ok_or_else(|| "OS cache directory is unavailable.".to_string())?
        .join(CEF_CACHE_DIR);
    std::fs::create_dir_all(&cache_path).map_err(|error| error.to_string())?;
    let settings = cef_settings(&cache_path);
    let mut app = OsrApp::new();

    // SAFETY: null sandbox info, as required on Linux. Called on the main
    // application thread before GTK; both share the GLib main loop.
    let ok = cef::initialize(
        Some(args.as_main_args()),
        Some(&settings),
        Some(&mut app),
        std::ptr::null_mut(),
    );
    if ok != 1 {
        return Err(format!(
            "cef::initialize failed (exit code {})",
            cef::get_exit_code()
        ));
    }
    INITIALIZED.store(true, Ordering::SeqCst);
    Ok(())
}

fn prepare_linux_threading() -> Result<(), String> {
    // SAFETY: this is the first Xlib work in the process, before CEF and GTK.
    if unsafe { XInitThreads() } == 0 {
        return Err("XInitThreads failed before CEF initialization.".to_string());
    }
    Ok(())
}

fn schedule_message_pump(delay_ms: i64) {
    let generation = PUMP_GENERATION
        .fetch_add(1, Ordering::AcqRel)
        .wrapping_add(1);
    let delay = Duration::from_millis(delay_ms.max(0) as u64);
    gtk::glib::timeout_add_once(delay, move || {
        if INITIALIZED.load(Ordering::Acquire)
            && PUMP_GENERATION.load(Ordering::Acquire) == generation
        {
            cef::do_message_loop_work();
        }
    });
}

fn cef_settings(cache_path: &Path) -> Settings {
    let cache_path: CefString = cache_path.to_string_lossy().as_ref().into();
    Settings {
        no_sandbox: 1,
        // Required for any windowless (OSR) browser to be creatable at all.
        windowless_rendering_enabled: 1,
        // Keep CEF and GTK on one UI thread. CEF schedules one-shot GLib work,
        // so idle browsers do not pay for a polling timer.
        multi_threaded_message_loop: 0,
        external_message_pump: 1,
        cache_path: cache_path.clone(),
        root_cache_path: cache_path,
        locale: CEF_LOCALE.into(),
        ..Default::default()
    }
}

#[tauri::command]
pub fn cef_viewport_open(
    url: String,
    width: u32,
    height: u32,
    scale_factor: f64,
    on_frame: Channel<InvokeResponseBody>,
    on_cursor: Channel<String>,
    on_address: Channel<String>,
) -> Result<(), String> {
    let parsed = url::Url::parse(&url).map_err(|error| error.to_string())?;
    if !matches!(parsed.scheme(), "http" | "https") {
        return Err("CEF viewport only accepts http/https URLs.".to_string());
    }
    let width = i32::try_from(width).map_err(|_| "CEF viewport width is too large.".to_string())?;
    let height =
        i32::try_from(height).map_err(|_| "CEF viewport height is too large.".to_string())?;
    if width <= 0 || height <= 0 {
        return Err("CEF viewport dimensions must be positive.".to_string());
    }
    if !scale_factor.is_finite()
        || !(0.0..=MAX_DEVICE_SCALE_FACTOR).contains(&scale_factor)
        || scale_factor == 0.0
    {
        return Err("CEF viewport scale factor is invalid.".to_string());
    }

    on_cef_ui(move || {
        open_browser(
            url,
            width,
            height,
            scale_factor as f32,
            on_frame,
            on_cursor,
            on_address,
        )
    })?
}

#[tauri::command]
pub fn cef_viewport_resize(width: u32, height: u32, scale_factor: f64) -> Result<(), String> {
    let width = i32::try_from(width).map_err(|_| "CEF viewport width is too large.".to_string())?;
    let height =
        i32::try_from(height).map_err(|_| "CEF viewport height is too large.".to_string())?;
    if width <= 0
        || height <= 0
        || !scale_factor.is_finite()
        || scale_factor <= 0.0
        || scale_factor > MAX_DEVICE_SCALE_FACTOR
    {
        return Err("CEF viewport size is invalid.".to_string());
    }
    on_cef_ui(move || {
        BROWSER.with(|cell| {
            if let Some(state) = cell.borrow().as_ref() {
                state.width.set(width);
                state.height.set(height);
                state.scale_factor.set(scale_factor as f32);
                state.full_frame_pending.set(true);
                if let Some(host) = state.browser.host() {
                    host.notify_screen_info_changed();
                    host.was_resized();
                }
            }
        });
    })
}

#[tauri::command]
pub fn cef_viewport_close() -> Result<(), String> {
    on_cef_ui(close_browser)
}

#[tauri::command]
pub fn cef_viewport_reload() -> Result<(), String> {
    on_cef_ui(|| {
        BROWSER.with(|cell| {
            if let Some(state) = cell.borrow().as_ref() {
                state.browser.reload();
            }
        });
    })
}

#[tauri::command]
pub fn cef_viewport_input(events: Vec<CefInputEvent>) -> Result<(), String> {
    on_cef_ui(move || dispatch_input(events))?
}

fn on_cef_ui<T: Send + 'static>(task: impl FnOnce() -> T + Send + 'static) -> Result<T, String> {
    if cef::currently_on(ThreadId::UI) == 1 {
        return Ok(task());
    }
    let (tx, rx) = std::sync::mpsc::channel();
    let job = move || {
        let _ = tx.send(task());
    };
    let mut task = CefUiTask::new(Arc::new(Mutex::new(Some(Box::new(job)))));
    if cef::post_task(ThreadId::UI, Some(&mut task)) != 1 {
        return Err("CEF UI thread rejected the viewport task.".to_string());
    }
    rx.recv()
        .map_err(|_| "CEF viewport task was dropped by the UI thread.".to_string())
}

#[allow(clippy::too_many_arguments)]
fn open_browser(
    url: String,
    width: i32,
    height: i32,
    scale_factor: f32,
    on_frame: Channel<InvokeResponseBody>,
    on_cursor: Channel<String>,
    on_address: Channel<String>,
) -> Result<(), String> {
    if !INITIALIZED.load(Ordering::SeqCst) {
        return Err("CEF is not initialized.".to_string());
    }
    close_browser();

    let width = Rc::new(Cell::new(width));
    let height = Rc::new(Cell::new(height));
    let scale_factor = Rc::new(Cell::new(scale_factor));
    let full_frame_pending = Rc::new(Cell::new(true));
    let render_handler = OsrRenderHandler::new(
        width.clone(),
        height.clone(),
        scale_factor.clone(),
        full_frame_pending.clone(),
        on_frame,
    );
    let display_handler = OsrDisplayHandler::new(on_cursor, on_address);
    let mut client = OsrClient::new(render_handler, display_handler);
    let window_info = WindowInfo::default().set_as_windowless(Default::default());
    let browser_settings = BrowserSettings {
        windowless_frame_rate: TARGET_FRAME_RATE,
        background_color: 0xFFFF_FFFF,
        ..Default::default()
    };
    let browser = cef::browser_host_create_browser_sync(
        Some(&window_info),
        Some(&mut client),
        Some(&url.as_str().into()),
        Some(&browser_settings),
        None,
        None,
    )
    .ok_or_else(|| "CEF failed to create the OSR browser.".to_string())?;
    BROWSER.with(|cell| {
        *cell.borrow_mut() = Some(BrowserState {
            browser,
            width,
            height,
            scale_factor,
            full_frame_pending,
        });
    });
    Ok(())
}

fn dispatch_input(events: Vec<CefInputEvent>) -> Result<(), String> {
    BROWSER.with(|cell| {
        let borrow = cell.borrow();
        let state = borrow
            .as_ref()
            .ok_or_else(|| "CEF viewport is not open.".to_string())?;
        let host = state
            .browser
            .host()
            .ok_or_else(|| "CEF browser host is unavailable.".to_string())?;

        for event in events {
            match event {
                CefInputEvent::Focus { focused } => host.set_focus(i32::from(focused)),
                CefInputEvent::MouseMove {
                    x,
                    y,
                    modifiers,
                    mouse_leave,
                } => host.send_mouse_move_event(
                    Some(&MouseEvent { x, y, modifiers }),
                    i32::from(mouse_leave),
                ),
                CefInputEvent::MouseClick {
                    x,
                    y,
                    modifiers,
                    button,
                    mouse_up,
                    click_count,
                } => {
                    if !(1..=3).contains(&click_count) {
                        return Err("CEF click count must be between 1 and 3.".to_string());
                    }
                    let button = match button {
                        CefMouseButton::Left => MouseButtonType::LEFT,
                        CefMouseButton::Middle => MouseButtonType::MIDDLE,
                        CefMouseButton::Right => MouseButtonType::RIGHT,
                    };
                    host.send_mouse_click_event(
                        Some(&MouseEvent { x, y, modifiers }),
                        button,
                        i32::from(mouse_up),
                        i32::from(click_count),
                    );
                }
                CefInputEvent::MouseWheel {
                    x,
                    y,
                    modifiers,
                    delta_x,
                    delta_y,
                } => host.send_mouse_wheel_event(
                    Some(&MouseEvent { x, y, modifiers }),
                    delta_x,
                    delta_y,
                ),
                CefInputEvent::Key {
                    event_type,
                    modifiers,
                    windows_key_code,
                    native_key_code,
                    is_system_key,
                    character,
                    unmodified_character,
                } => host.send_key_event(Some(&KeyEvent {
                    type_: match event_type {
                        CefKeyEventType::RawKeyDown => KeyEventType::RAWKEYDOWN,
                        CefKeyEventType::KeyUp => KeyEventType::KEYUP,
                        CefKeyEventType::Char => KeyEventType::CHAR,
                    },
                    modifiers,
                    windows_key_code,
                    native_key_code,
                    is_system_key: i32::from(is_system_key),
                    character,
                    unmodified_character,
                    ..Default::default()
                })),
            }
        }
        Ok(())
    })
}

fn cursor_css(cursor: CursorType) -> &'static str {
    match cursor {
        CursorType::HAND => "pointer",
        CursorType::IBEAM => "text",
        CursorType::CROSS => "crosshair",
        CursorType::WAIT => "wait",
        CursorType::PROGRESS => "progress",
        CursorType::MOVE => "move",
        CursorType::EASTRESIZE
        | CursorType::WESTRESIZE
        | CursorType::EASTWESTRESIZE
        | CursorType::COLUMNRESIZE => "ew-resize",
        CursorType::NORTHRESIZE
        | CursorType::SOUTHRESIZE
        | CursorType::NORTHSOUTHRESIZE
        | CursorType::ROWRESIZE => "ns-resize",
        CursorType::NORTHEASTRESIZE
        | CursorType::SOUTHWESTRESIZE
        | CursorType::NORTHEASTSOUTHWESTRESIZE => "nesw-resize",
        CursorType::NORTHWESTRESIZE
        | CursorType::SOUTHEASTRESIZE
        | CursorType::NORTHWESTSOUTHEASTRESIZE => "nwse-resize",
        CursorType::NOTALLOWED | CursorType::NODROP => "not-allowed",
        CursorType::GRAB => "grab",
        CursorType::GRABBING => "grabbing",
        CursorType::NONE => "none",
        _ => "default",
    }
}

fn close_browser() {
    BROWSER.with(|cell| {
        if let Some(state) = cell.borrow_mut().take() {
            if let Some(host) = state.browser.host() {
                host.close_browser(1);
            }
        }
    });
}

fn encode_frame(
    pixels: &[u8],
    width: i32,
    height: i32,
    dirty_rects: &[Rect],
    painted_at_ms: f64,
) -> Result<Vec<u8>, String> {
    let width_usize = usize::try_from(width).map_err(|_| "invalid CEF frame width")?;
    let height_usize = usize::try_from(height).map_err(|_| "invalid CEF frame height")?;
    let expected_len = width_usize
        .checked_mul(height_usize)
        .and_then(|value| value.checked_mul(BYTES_PER_PIXEL))
        .ok_or("CEF frame size overflow")?;
    if pixels.len() != expected_len || dirty_rects.is_empty() {
        return Err("invalid CEF frame buffer".to_string());
    }

    let mut pixel_bytes = 0usize;
    for rect in dirty_rects {
        if rect.x < 0
            || rect.y < 0
            || rect.width <= 0
            || rect.height <= 0
            || rect.x + rect.width > width
            || rect.y + rect.height > height
        {
            return Err("invalid CEF dirty rect".to_string());
        }
        pixel_bytes = pixel_bytes
            .checked_add(rect.width as usize * rect.height as usize * BYTES_PER_PIXEL)
            .ok_or("CEF dirty rect size overflow")?;
    }
    let rect_headers = dirty_rects
        .len()
        .checked_mul(RECT_HEADER_BYTES)
        .ok_or("CEF dirty rect header overflow")?;
    let capacity = FRAME_HEADER_BYTES
        .checked_add(rect_headers)
        .and_then(|value| value.checked_add(pixel_bytes))
        .ok_or("CEF frame packet overflow")?;
    let mut packet = Vec::with_capacity(capacity);
    packet.extend_from_slice(&FRAME_VERSION.to_le_bytes());
    packet.extend_from_slice(&(width as u32).to_le_bytes());
    packet.extend_from_slice(&(height as u32).to_le_bytes());
    packet.extend_from_slice(&(dirty_rects.len() as u32).to_le_bytes());
    packet.extend_from_slice(&painted_at_ms.to_le_bytes());
    for rect in dirty_rects {
        packet.extend_from_slice(&rect.x.to_le_bytes());
        packet.extend_from_slice(&rect.y.to_le_bytes());
        packet.extend_from_slice(&rect.width.to_le_bytes());
        packet.extend_from_slice(&rect.height.to_le_bytes());
    }
    let source_stride = width_usize * BYTES_PER_PIXEL;
    for rect in dirty_rects {
        let row_bytes = rect.width as usize * BYTES_PER_PIXEL;
        for row in rect.y as usize..(rect.y + rect.height) as usize {
            let start = row * source_stride + rect.x as usize * BYTES_PER_PIXEL;
            packet.extend_from_slice(&pixels[start..start + row_bytes]);
        }
    }
    Ok(packet)
}

/// Tears CEF down. Main thread only, and only from the exit path.
///
/// This must run before the process exits, otherwise CEF's child processes are
/// orphaned and survive as zombies. `lib.rs` hard-exits on `ExitRequested`
/// (Tauri teardown deadlocks on Linux), so this is called from there rather
/// than relying on any Drop impl, which a `process::exit` would skip.
pub fn shutdown() {
    if INITIALIZED.load(Ordering::SeqCst) {
        let _ = on_cef_ui(close_browser);
        cef::shutdown();
        INITIALIZED.store(false, Ordering::SeqCst);
    }
}

#[cfg(test)]
mod tests {
    use super::{
        browser_switch_values, browser_switches, cef_settings, cursor_css, encode_frame,
        initialize_api_version, set_enabled_at, CefInputEvent,
    };
    use cef::{CursorType, Rect};
    use std::path::Path;

    #[test]
    fn cef_integrates_with_gtk_main_thread() {
        let settings = cef_settings(Path::new("/tmp/polyui-cef-test"));

        assert_eq!(settings.external_message_pump, 1);
        assert_eq!(settings.multi_threaded_message_loop, 0);
        assert_eq!(settings.cache_path.to_string(), "/tmp/polyui-cef-test");
        assert_eq!(settings.root_cache_path.to_string(), "/tmp/polyui-cef-test");
        assert_eq!(settings.locale.to_string(), "en-US");
    }

    #[test]
    fn cpu_osr_disables_unneeded_gpu_processes() {
        assert_eq!(
            browser_switches(),
            ["disable-gpu", "disable-gpu-compositing"]
        );
        assert_eq!(browser_switch_values(), [("disk-cache-size", "67108864")]);
    }

    #[test]
    fn cef_preference_can_be_enabled_and_disabled() {
        let path = std::env::temp_dir().join(format!("polyui-cef-enabled-{}", std::process::id()));
        let _ = std::fs::remove_file(&path);

        set_enabled_at(&path, true).expect("enable CEF preference");
        assert!(path.is_file());

        set_enabled_at(&path, false).expect("disable CEF preference");
        assert!(!path.exists());
    }

    #[test]
    fn cef_selects_generated_api_version_before_callbacks() {
        initialize_api_version();

        assert_eq!(cef::api_version(), cef::sys::CEF_API_VERSION_LAST);
    }

    #[test]
    fn frame_packet_contains_only_dirty_rect_pixels() {
        let pixels = [
            0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23,
        ];
        let rect = Rect {
            x: 1,
            y: 0,
            width: 2,
            height: 2,
        };

        let packet = encode_frame(&pixels, 3, 2, &[rect], 1234.5).expect("valid frame");

        assert_eq!(packet.len(), 24 + 16 + 16);
        assert_eq!(
            &packet[40..],
            &[4, 5, 6, 7, 8, 9, 10, 11, 16, 17, 18, 19, 20, 21, 22, 23]
        );
    }

    #[test]
    fn input_event_deserializes_camel_case_frontend_fields() {
        let event: CefInputEvent = serde_json::from_value(serde_json::json!({
            "kind": "mouse_click",
            "x": 12,
            "y": 34,
            "modifiers": 16,
            "button": "left",
            "mouseUp": false,
            "clickCount": 2
        }))
        .expect("valid CEF input event");

        assert!(matches!(
            event,
            CefInputEvent::MouseClick {
                x: 12,
                y: 34,
                click_count: 2,
                ..
            }
        ));
    }

    #[test]
    fn common_cef_cursors_map_to_css() {
        assert_eq!(cursor_css(CursorType::HAND), "pointer");
        assert_eq!(cursor_css(CursorType::IBEAM), "text");
        assert_eq!(cursor_css(CursorType::NORTHSOUTHRESIZE), "ns-resize");
    }
}
