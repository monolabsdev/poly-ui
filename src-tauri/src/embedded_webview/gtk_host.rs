//! Linux backend: raw wry webviews inside the shared GtkFixed overlay.
//!
//! Tauri's `add_child` cannot position child webviews on GTK (see
//! `crate::gtk_overlay`), so webviews are built directly with wry into the
//! shared pass-through GtkFixed. Raw wry webviews receive no Tauri IPC or
//! plugin init scripts, so remote pages cannot reach app commands at all.
//!
//! Snapshots use WebKitGTK's `webkit_web_view_get_snapshot` (visible region)
//! and encode the returned cairo surface as PNG.

use super::host::{HostError, WebviewHost, ZOrder};
use super::{
    emit_event, EmbeddedWebviewEventKind, WebviewBounds, COLLECTOR_SCRIPT, NEW_WINDOW_TO_SELF,
};
use crate::gtk_overlay::{ensure_fixed, on_main};
use gtk::prelude::*;
use std::cell::RefCell;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Url};
use webkit2gtk::WebViewExt;
use wry::{WebViewBuilderExtUnix, WebViewExtUnix};

const SNAPSHOT_TIMEOUT: Duration = Duration::from_secs(5);
const EVAL_TIMEOUT: Duration = Duration::from_secs(5);

// wry::WebView is !Send; all instances live on the GTK main thread.
thread_local! {
    static WEBVIEWS: RefCell<HashMap<String, wry::WebView>> = RefCell::new(HashMap::new());
}

pub struct GtkWebviewHost {
    app: AppHandle,
}

impl GtkWebviewHost {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }
}

fn bounds_rect(bounds: WebviewBounds) -> wry::Rect {
    wry::Rect {
        position: wry::dpi::LogicalPosition::new(bounds.x, bounds.y).into(),
        size: wry::dpi::LogicalSize::new(bounds.width.max(1.0), bounds.height.max(1.0)).into(),
    }
}

/// Look up a webview on the main thread; `NotFound` at the manager level
/// should make this unreachable, so a miss is a platform-state error.
fn with_webview<T>(
    label: &str,
    f: impl FnOnce(&wry::WebView) -> Result<T, HostError>,
) -> Result<T, HostError> {
    WEBVIEWS.with(|cell| {
        let borrow = cell.borrow();
        let webview = borrow.get(label).ok_or_else(|| {
            HostError::Platform(format!("Native webview for {label:?} is missing."))
        })?;
        f(webview)
    })
}

impl WebviewHost for GtkWebviewHost {
    fn create(&self, label: &str, url: &Url, bounds: WebviewBounds) -> Result<(), HostError> {
        let handle = self.app.clone();
        let label = label.to_string();
        let url = url.to_string();
        on_main(&self.app, move || -> Result<(), HostError> {
            let fixed = ensure_fixed(&handle).map_err(HostError::Platform)?;

            let load_handle = handle.clone();
            let load_label = label.clone();
            let title_handle = handle.clone();
            let title_label = label.clone();
            let nav_handle = handle.clone();
            let nav_label = label.clone();

            let webview = wry::WebViewBuilder::new()
                .with_url(&url)
                .with_initialization_script(COLLECTOR_SCRIPT)
                .with_initialization_script(NEW_WINDOW_TO_SELF)
                // Backstop: nothing the script misses may leak an orphan window.
                .with_new_window_req_handler(|_url, _features| wry::NewWindowResponse::Deny)
                .with_bounds(bounds_rect(bounds))
                .with_on_page_load_handler(move |event, page_url| {
                    let kind = match event {
                        wry::PageLoadEvent::Started => {
                            EmbeddedWebviewEventKind::LoadStarted { url: page_url }
                        }
                        wry::PageLoadEvent::Finished => {
                            EmbeddedWebviewEventKind::LoadFinished { url: page_url }
                        }
                    };
                    emit_event(&load_handle, &load_label, kind);
                })
                .with_document_title_changed_handler(move |title| {
                    emit_event(
                        &title_handle,
                        &title_label,
                        EmbeddedWebviewEventKind::TitleChanged { title },
                    );
                })
                .with_navigation_handler(move |target| {
                    // Same scheme policy as creation: only http(s) may load.
                    let allowed = target.starts_with("http://") || target.starts_with("https://");
                    if allowed {
                        emit_event(
                            &nav_handle,
                            &nav_label,
                            EmbeddedWebviewEventKind::UrlChanged { url: target },
                        );
                    }
                    allowed
                })
                .build_gtk(&fixed)
                .map_err(HostError::platform)?;

            // Persist geometry in GTK too, so window re-layouts don't snap
            // the widget back (see gtk_overlay docs).
            let widget = WebViewExtUnix::webview(&webview);
            fixed.move_(&widget, bounds.x as i32, bounds.y as i32);
            widget.set_size_request(bounds.width as i32, bounds.height as i32);

            WEBVIEWS.with(|cell| cell.borrow_mut().insert(label, webview));
            Ok(())
        })
        .map_err(HostError::Platform)?
    }

    fn navigate(&self, label: &str, url: &Url) -> Result<(), HostError> {
        let label = label.to_string();
        let url = url.to_string();
        on_main(&self.app, move || {
            with_webview(&label, |webview| {
                webview.load_url(&url).map_err(HostError::platform)
            })
        })
        .map_err(HostError::Platform)?
    }

    fn reload(&self, label: &str) -> Result<(), HostError> {
        let label = label.to_string();
        on_main(&self.app, move || {
            with_webview(&label, |webview| webview.reload().map_err(HostError::platform))
        })
        .map_err(HostError::Platform)?
    }

    fn set_bounds(&self, label: &str, bounds: WebviewBounds) -> Result<(), HostError> {
        let handle = self.app.clone();
        let label = label.to_string();
        on_main(&self.app, move || {
            with_webview(&label, |webview| {
                if let Ok(fixed) = ensure_fixed(&handle) {
                    let widget = WebViewExtUnix::webview(webview);
                    fixed.move_(&widget, bounds.x as i32, bounds.y as i32);
                    widget.set_size_request(bounds.width as i32, bounds.height as i32);
                }
                webview
                    .set_bounds(bounds_rect(bounds))
                    .map_err(HostError::platform)
            })
        })
        .map_err(HostError::Platform)?
    }

    fn set_visible(&self, label: &str, visible: bool) -> Result<(), HostError> {
        let label = label.to_string();
        on_main(&self.app, move || {
            with_webview(&label, |webview| {
                webview.set_visible(visible).map_err(HostError::platform)
            })
        })
        .map_err(HostError::Platform)?
    }

    fn set_z_order(&self, _label: &str, _z_order: ZOrder) -> Result<(), HostError> {
        // GtkFixed stacks children in insertion order and exposes no restack
        // API for this setup; the composition-hosting backend is the seam for
        // real z-order control.
        Err(HostError::Unsupported(
            "Z-ordering embedded webviews is not supported on Linux.".into(),
        ))
    }

    fn eval(&self, label: &str, js: String) -> Result<String, HostError> {
        let label = label.to_string();
        let (tx, rx) = std::sync::mpsc::channel::<String>();
        let tx = Mutex::new(Some(tx));
        on_main(&self.app, move || {
            with_webview(&label, |webview| {
                webview
                    .evaluate_script_with_callback(&js, move |result| {
                        if let Some(tx) = tx.lock().unwrap_or_else(|e| e.into_inner()).take() {
                            let _ = tx.send(result);
                        }
                    })
                    .map_err(HostError::platform)
            })
        })
        .map_err(HostError::Platform)??;
        rx.recv_timeout(EVAL_TIMEOUT).map_err(|_| {
            HostError::Platform("The page did not respond in time; it may still be loading.".into())
        })
    }

    fn snapshot(&self, label: &str) -> Result<Vec<u8>, HostError> {
        let label = label.to_string();
        let (tx, rx) = std::sync::mpsc::channel::<Result<Vec<u8>, HostError>>();
        on_main(&self.app, move || {
            with_webview(&label, |webview| {
                let wk_view = WebViewExtUnix::webview(webview);
                wk_view.snapshot(
                    webkit2gtk::SnapshotRegion::Visible,
                    webkit2gtk::SnapshotOptions::NONE,
                    None::<&gtk::gio::Cancellable>,
                    move |result| {
                        let _ = tx.send(encode_snapshot(result));
                    },
                );
                Ok(())
            })
        })
        .map_err(HostError::Platform)??;
        rx.recv_timeout(SNAPSHOT_TIMEOUT)
            .map_err(|_| HostError::Platform("The page snapshot timed out.".into()))?
    }

    fn destroy(&self, label: &str) -> Result<(), HostError> {
        let handle = self.app.clone();
        let label = label.to_string();
        on_main(&self.app, move || {
            let Some(webview) = WEBVIEWS.with(|cell| cell.borrow_mut().remove(&label)) else {
                return Ok(());
            };
            if let Ok(fixed) = ensure_fixed(&handle) {
                fixed.remove(&WebViewExtUnix::webview(&webview));
            }
            drop(webview);
            Ok(())
        })
        .map_err(HostError::Platform)?
    }
}

fn encode_snapshot(
    result: Result<gtk::cairo::Surface, gtk::glib::Error>,
) -> Result<Vec<u8>, HostError> {
    let surface = result.map_err(HostError::platform)?;
    let image = gtk::cairo::ImageSurface::try_from(surface)
        .map_err(|_| HostError::Platform("Snapshot surface is not an image surface.".into()))?;
    let mut png = Vec::new();
    image.write_to_png(&mut png).map_err(HostError::platform)?;
    Ok(png)
}
