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
//!
//! ## Threading invariants
//!
//! - `execute_subprocess` MUST be the first thing `main` does, before any
//!   thread is spawned. CEF forks a zygote on Linux; forking a process that
//!   already has threads is undefined behaviour.
//! - `init`, `pump`, and `shutdown` MUST all run on the main (GTK) thread.
//!   CEF's UI thread is the thread that called `initialize`.

use cef::{args::Args, *};
use std::cell::{Cell, RefCell};
use std::rc::Rc;
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use tauri::ipc::{Channel, InvokeResponseBody};
use tauri::AppHandle;

/// How often GTK hands time to CEF. One pump per target frame.
const MESSAGE_PUMP_INTERVAL: Duration = Duration::from_millis(16);
const TARGET_FRAME_RATE: i32 = 60;
const FRAME_VERSION: u32 = 1;
const FRAME_HEADER_BYTES: usize = 24;
const RECT_HEADER_BYTES: usize = 16;
const BYTES_PER_PIXEL: usize = 4;
const MAX_DEVICE_SCALE_FACTOR: f64 = 8.0;

/// Set once `initialize` succeeds, so `shutdown` cannot run against an
/// uninitialized CEF (which aborts inside Chromium) and cannot run twice.
static INITIALIZED: AtomicBool = AtomicBool::new(false);

struct BrowserState {
    browser: Browser,
    width: Rc<Cell<i32>>,
    height: Rc<Cell<i32>>,
    scale_factor: Rc<Cell<f32>>,
    full_frame_pending: Rc<Cell<bool>>,
}

thread_local! {
    static BROWSER: RefCell<Option<BrowserState>> = const { RefCell::new(None) };
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

cef::wrap_client! {
    struct OsrClient {
        render_handler: RenderHandler,
    }

    impl Client {
        fn render_handler(&self) -> Option<RenderHandler> {
            Some(self.render_handler.clone())
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

/// Initializes CEF in the browser process. Main thread only.
pub fn init() -> Result<(), String> {
    let args = Args::new();
    let settings = cef_settings();

    // SAFETY: null sandbox info, as required on Linux. Called on the main
    // thread before any browser exists; this thread becomes CEF's UI thread.
    let ok = cef::initialize(
        Some(args.as_main_args()),
        Some(&settings),
        None,
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

fn cef_settings() -> Settings {
    Settings {
        no_sandbox: 1,
        // Required for any windowless (OSR) browser to be creatable at all.
        windowless_rendering_enabled: 1,
        // Tauri owns GTK's event loop. Keep CEF from installing a competing
        // native pump; `start_pump` supplies CefDoMessageLoopWork instead.
        multi_threaded_message_loop: 0,
        external_message_pump: 1,
        ..Default::default()
    }
}

#[tauri::command]
pub fn cef_viewport_open(
    app: AppHandle,
    url: String,
    width: u32,
    height: u32,
    scale_factor: f64,
    on_frame: Channel<InvokeResponseBody>,
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

    on_main(&app, move || {
        open_browser(url, width, height, scale_factor as f32, on_frame)
    })?
}

#[tauri::command]
pub fn cef_viewport_resize(
    app: AppHandle,
    width: u32,
    height: u32,
    scale_factor: f64,
) -> Result<(), String> {
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
    on_main(&app, move || {
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
pub fn cef_viewport_close(app: AppHandle) -> Result<(), String> {
    on_main(&app, close_browser)
}

#[tauri::command]
pub fn cef_viewport_reload(app: AppHandle) -> Result<(), String> {
    on_main(&app, || {
        BROWSER.with(|cell| {
            if let Some(state) = cell.borrow().as_ref() {
                state.browser.reload();
            }
        });
    })
}

fn on_main<T: Send + 'static>(
    app: &AppHandle,
    task: impl FnOnce() -> T + Send + 'static,
) -> Result<T, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(task());
    })
    .map_err(|error| error.to_string())?;
    rx.recv()
        .map_err(|_| "CEF viewport task was dropped by the main thread.".to_string())
}

fn open_browser(
    url: String,
    width: i32,
    height: i32,
    scale_factor: f32,
    on_frame: Channel<InvokeResponseBody>,
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
    let mut client = OsrClient::new(render_handler);
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

/// Gives CEF a slice of main-thread time. Safe to call before `init`, where it
/// is a no-op.
fn pump() {
    if INITIALIZED.load(Ordering::SeqCst) {
        cef::do_message_loop_work();
    }
}

/// Starts the GTK timer that pumps CEF. Main thread only.
pub fn start_pump() {
    gtk::glib::timeout_add_local(MESSAGE_PUMP_INTERVAL, || {
        pump();
        gtk::glib::ControlFlow::Continue
    });
}

/// Tears CEF down. Main thread only, and only from the exit path.
///
/// This must run before the process exits, otherwise CEF's child processes are
/// orphaned and survive as zombies. `lib.rs` hard-exits on `ExitRequested`
/// (Tauri teardown deadlocks on Linux), so this is called from there rather
/// than relying on any Drop impl, which a `process::exit` would skip.
pub fn shutdown() {
    if INITIALIZED.swap(false, Ordering::SeqCst) {
        close_browser();
        cef::shutdown();
    }
}

#[cfg(test)]
mod tests {
    use super::{cef_settings, encode_frame, initialize_api_version};
    use cef::Rect;

    #[test]
    fn cef_uses_external_message_pump_inside_tauri_gtk_loop() {
        let settings = cef_settings();

        assert_eq!(settings.external_message_pump, 1);
        assert_eq!(settings.multi_threaded_message_loop, 0);
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
}
