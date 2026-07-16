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

use cef::{args::Args, Settings};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Duration;

/// How often the GTK main loop hands time to CEF. 60 Hz — one pump per frame
/// at the target rate. This bounds worst-case frame latency: a frame finished
/// just after a pump waits up to this long to be delivered. See spike-notes.md
/// ("Message-loop strategy") for why a timer rather than an external pump.
const MESSAGE_PUMP_INTERVAL: Duration = Duration::from_millis(16);

/// Set once `initialize` succeeds, so `shutdown` cannot run against an
/// uninitialized CEF (which aborts inside Chromium) and cannot run twice.
static INITIALIZED: AtomicBool = AtomicBool::new(false);

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
    let args = Args::new();
    // SAFETY: the third argument is Windows sandbox info; CEF requires null on
    // every other platform. `None` for the app: the spike registers no custom
    // process handlers, so the subprocesses need no Rust-side callbacks.
    let code = cef::execute_process(Some(args.as_main_args()), None, std::ptr::null_mut());
    // >= 0 means "this process was a CEF subprocess and has finished".
    // -1 means "this is the browser process, carry on".
    (code >= 0).then_some(code)
}

/// Initializes CEF in the browser process. Main thread only.
pub fn init() -> Result<(), String> {
    let args = Args::new();
    let settings = Settings {
        no_sandbox: 1,
        // Required for any windowless (OSR) browser to be creatable at all.
        windowless_rendering_enabled: 1,
        // Both message-loop shortcuts are off: we drive CEF from the GTK loop
        // via `pump`. `multi_threaded_message_loop` is Windows-only, and
        // `external_message_pump` would require a BrowserProcessHandler.
        multi_threaded_message_loop: 0,
        external_message_pump: 0,
        ..Default::default()
    };

    // SAFETY: null sandbox info, as required on Linux. Called on the main
    // thread before any browser exists; this thread becomes CEF's UI thread.
    let ok = cef::initialize(Some(args.as_main_args()), Some(&settings), None, std::ptr::null_mut());
    if ok != 1 {
        return Err(format!(
            "cef::initialize failed (exit code {})",
            cef::get_exit_code()
        ));
    }
    INITIALIZED.store(true, Ordering::SeqCst);
    Ok(())
}

/// Gives CEF a slice of main-thread time. Safe to call before `init`, where it
/// is a no-op.
fn pump() {
    if INITIALIZED.load(Ordering::SeqCst) {
        cef::do_message_loop_work();
    }
}

/// Starts the GTK timer that pumps CEF. Main thread only; `init` must have run.
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
        cef::shutdown();
    }
}
