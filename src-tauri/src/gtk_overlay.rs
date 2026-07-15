//! Shared GtkFixed overlay layer for webviews embedded in the main window on
//! Linux, where Tauri's `add_child` packs children into the window's GtkBox
//! (splitting the layout) and `set_bounds` is a no-op. wry *can* position
//! webviews inside a GtkFixed, so the window content is wrapped in a
//! GtkOverlay (once) with a pass-through GtkFixed layer on top, and raw wry
//! webviews are built into that layer.
//!
//! Both the agent viewport and the embedded webview manager place webviews in
//! this single layer; wrapping the window twice would detach the first
//! overlay, so the GtkFixed is a process-wide (main-thread) singleton.

use gtk::prelude::*;
use std::cell::RefCell;
use tauri::{AppHandle, Manager};

// GTK objects are main-thread only; every entry point hops onto the GTK main
// thread via `on_main` and the state lives in thread-locals.
thread_local! {
    static FIXED: RefCell<Option<gtk::Fixed>> = const { RefCell::new(None) };
}

/// Run `f` on the GTK main thread and wait for its result.
pub fn on_main<T: Send + 'static>(
    app: &AppHandle,
    f: impl FnOnce() -> T + Send + 'static,
) -> Result<T, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app.run_on_main_thread(move || {
        let _ = tx.send(f());
    })
    .map_err(|e| e.to_string())?;
    rx.recv()
        .map_err(|_| "The webview task was dropped by the main thread.".to_string())
}

/// Wrap the main window's content in a GtkOverlay (once) and return the
/// GtkFixed layer embedded webviews live in. Main thread only.
pub fn ensure_fixed(app: &AppHandle) -> Result<gtk::Fixed, String> {
    if let Some(fixed) = FIXED.with(|f| f.borrow().clone()) {
        return Ok(fixed);
    }
    let window = app.get_window("main").ok_or("Main window not found.")?;
    let gtk_window = window.gtk_window().map_err(|e| e.to_string())?;
    let vbox = window.default_vbox().map_err(|e| e.to_string())?;

    let overlay = gtk::Overlay::new();
    gtk_window.remove(&vbox);
    overlay.add(&vbox);
    let fixed = gtk::Fixed::new();
    overlay.add_overlay(&fixed);
    // The fixed layer must not steal clicks from the app underneath.
    overlay.set_overlay_pass_through(&fixed, true);
    gtk_window.add(&overlay);
    fixed.show();
    overlay.show();

    FIXED.with(|f| *f.borrow_mut() = Some(fixed.clone()));
    Ok(fixed)
}
