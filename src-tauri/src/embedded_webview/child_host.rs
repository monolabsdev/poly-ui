//! macOS/Windows backend: Tauri child webviews of the main window
//! (`Window::add_child`), keyed by a namespaced Tauri label.
//!
//! Snapshots:
//! - Windows: WebView2 `CapturePreview` into an in-memory COM stream.
//! - macOS: WKWebView `takeSnapshot`, encoded to PNG via NSBitmapImageRep.
//!
//! Both captures are initiated on the main thread (`with_webview`) and
//! complete asynchronously there; the calling worker thread blocks on a
//! channel with a timeout, mirroring the agent viewport's main-thread-hop
//! pattern.

use super::host::{HostError, WebviewHost, ZOrder};
use super::{
    emit_event, EmbeddedWebviewEventKind, WebviewBounds, COLLECTOR_SCRIPT, NEW_WINDOW_TO_SELF,
};
use std::sync::Mutex;
use std::time::Duration;
use tauri::webview::PageLoadEvent;
use tauri::{AppHandle, LogicalPosition, LogicalSize, Manager, Rect, Url, WebviewUrl};

const SNAPSHOT_TIMEOUT: Duration = Duration::from_secs(5);
const EVAL_TIMEOUT: Duration = Duration::from_secs(5);

/// Tauri plugin shims (e.g. Notification) are injected into child webviews
/// but have no IPC permission there; replace them with an inert
/// standard-shaped API so remote pages don't hit capability rejections.
const NOTIFICATION_STUB: &str = r#"(() => {
  try {
    const inert = function Notification() { throw new TypeError("Notifications are disabled in this viewport."); };
    inert.permission = "denied";
    inert.requestPermission = () => Promise.resolve("denied");
    Object.defineProperty(window, "Notification", { value: inert, configurable: true });
  } catch (_) { /* leave the page's own API untouched */ }
})();"#;

/// Namespace frontend labels so they can never collide with app windows or
/// the agent viewport ("main", "agent-viewport", ...).
fn tauri_label(label: &str) -> String {
    format!("embedded-{label}")
}

pub struct ChildWebviewHost {
    app: AppHandle,
}

impl ChildWebviewHost {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    fn webview(&self, label: &str) -> Result<tauri::Webview, HostError> {
        self.app
            .webviews()
            .remove(&tauri_label(label))
            .ok_or_else(|| {
                HostError::Platform(format!("Native webview for {label:?} is missing."))
            })
    }
}

fn rect(bounds: WebviewBounds) -> Rect {
    Rect {
        position: LogicalPosition::new(bounds.x, bounds.y).into(),
        size: LogicalSize::new(bounds.width.max(1.0), bounds.height.max(1.0)).into(),
    }
}

impl WebviewHost for ChildWebviewHost {
    fn create(&self, label: &str, url: &Url, bounds: WebviewBounds) -> Result<(), HostError> {
        let window = self
            .app
            .get_window("main")
            .ok_or_else(|| HostError::Platform("Main window not found.".into()))?;

        let load_handle = self.app.clone();
        let load_label = label.to_string();
        let title_label = label.to_string();
        let nav_handle = self.app.clone();
        let nav_label = label.to_string();

        let builder = tauri::webview::WebviewBuilder::new(
            tauri_label(label),
            WebviewUrl::External(url.clone()),
        )
        .initialization_script(NOTIFICATION_STUB)
        .initialization_script(COLLECTOR_SCRIPT)
        .initialization_script(NEW_WINDOW_TO_SELF)
        // Backstop: nothing the script misses may leak an orphan OS window.
        .on_new_window(|_url, _features| tauri::webview::NewWindowResponse::Deny)
        .on_page_load(move |_webview, payload| {
            let url = payload.url().to_string();
            let kind = match payload.event() {
                PageLoadEvent::Started => EmbeddedWebviewEventKind::LoadStarted { url },
                PageLoadEvent::Finished => EmbeddedWebviewEventKind::LoadFinished { url },
            };
            emit_event(&load_handle, &load_label, kind);
        })
        .on_document_title_changed(move |webview, title| {
            emit_event(
                webview.app_handle(),
                &title_label,
                EmbeddedWebviewEventKind::TitleChanged { title },
            );
        })
        .on_navigation(move |target| {
            // Same scheme policy as creation: only http(s) may load.
            let allowed = matches!(target.scheme(), "http" | "https");
            if allowed {
                emit_event(
                    &nav_handle,
                    &nav_label,
                    EmbeddedWebviewEventKind::UrlChanged {
                        url: target.to_string(),
                    },
                );
            }
            allowed
        });

        window
            .add_child(
                builder,
                LogicalPosition::new(bounds.x, bounds.y),
                LogicalSize::new(bounds.width.max(1.0), bounds.height.max(1.0)),
            )
            .map_err(HostError::platform)?;
        Ok(())
    }

    fn navigate(&self, label: &str, url: &Url) -> Result<(), HostError> {
        self.webview(label)?
            .navigate(url.clone())
            .map_err(HostError::platform)
    }

    fn reload(&self, label: &str) -> Result<(), HostError> {
        self.webview(label)?.reload().map_err(HostError::platform)
    }

    fn set_bounds(&self, label: &str, bounds: WebviewBounds) -> Result<(), HostError> {
        self.webview(label)?
            .set_bounds(rect(bounds))
            .map_err(HostError::platform)
    }

    fn set_visible(&self, label: &str, visible: bool) -> Result<(), HostError> {
        let webview = self.webview(label)?;
        if visible {
            webview.show().map_err(HostError::platform)
        } else {
            webview.hide().map_err(HostError::platform)
        }
    }

    fn set_z_order(&self, _label: &str, _z_order: ZOrder) -> Result<(), HostError> {
        // Tauri exposes no restack API for child webviews; the
        // composition-hosting backend is the seam for real z-order control.
        Err(HostError::Unsupported(
            "Z-ordering embedded webviews requires the composition backend.".into(),
        ))
    }

    fn eval(&self, label: &str, js: String) -> Result<String, HostError> {
        let webview = self.webview(label)?;
        let (tx, rx) = std::sync::mpsc::channel::<String>();
        let tx = Mutex::new(Some(tx));
        webview
            .eval_with_callback(js, move |result| {
                if let Some(tx) = tx.lock().unwrap_or_else(|e| e.into_inner()).take() {
                    let _ = tx.send(result);
                }
            })
            .map_err(HostError::platform)?;
        rx.recv_timeout(EVAL_TIMEOUT).map_err(|_| {
            HostError::Platform("The page did not respond in time; it may still be loading.".into())
        })
    }

    fn snapshot(&self, label: &str) -> Result<Vec<u8>, HostError> {
        let webview = self.webview(label)?;
        let (tx, rx) = std::sync::mpsc::channel::<Result<Vec<u8>, HostError>>();
        webview
            .with_webview(move |platform| {
                platform_snapshot(platform, tx);
            })
            .map_err(HostError::platform)?;
        rx.recv_timeout(SNAPSHOT_TIMEOUT)
            .map_err(|_| HostError::Platform("The page snapshot timed out.".into()))?
    }

    fn destroy(&self, label: &str) -> Result<(), HostError> {
        self.webview(label)?.close().map_err(HostError::platform)
    }
}

type SnapshotSender = std::sync::mpsc::Sender<Result<Vec<u8>, HostError>>;

/// Kick off the platform capture. Runs on the main thread; must not block —
/// the completion callbacks are delivered on this same thread. On success the
/// completion handler sends the PNG; only setup failures are sent here.
#[cfg(target_os = "windows")]
fn platform_snapshot(platform: tauri::webview::PlatformWebview, tx: SnapshotSender) {
    if let Err(e) = windows_snapshot(&platform, tx.clone()) {
        let _ = tx.send(Err(e));
    }
}

/// WebView2 CapturePreview into an in-memory COM stream.
#[cfg(target_os = "windows")]
fn windows_snapshot(
    platform: &tauri::webview::PlatformWebview,
    tx: SnapshotSender,
) -> Result<(), HostError> {
    use webview2_com::CapturePreviewCompletedHandler;
    use webview2_com::Microsoft::Web::WebView2::Win32::COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG;
    use windows::Win32::Foundation::HGLOBAL;
    use windows::Win32::System::Com::IStream;
    use windows::Win32::System::Com::StructuredStorage::CreateStreamOnHGlobal;

    let (core, stream) = unsafe {
        let controller = platform.controller();
        let core = controller.CoreWebView2().map_err(HostError::platform)?;
        let stream: IStream =
            CreateStreamOnHGlobal(HGLOBAL::default(), true).map_err(HostError::platform)?;
        (core, stream)
    };

    let read_stream = stream.clone();
    let handler = CapturePreviewCompletedHandler::create(Box::new(move |result| {
        let png = result
            .ok()
            .map_err(HostError::platform)
            .and_then(|()| unsafe { read_stream_to_end(&read_stream) });
        let _ = tx.send(png);
        Ok(())
    }));
    unsafe {
        core.CapturePreview(
            COREWEBVIEW2_CAPTURE_PREVIEW_IMAGE_FORMAT_PNG,
            &stream,
            &handler,
        )
        .map_err(HostError::platform)
    }
}

/// Rewind a COM stream and read it fully.
///
/// # Safety
/// `stream` must be a live IStream; called from the WebView2 completion
/// handler on the main thread.
#[cfg(target_os = "windows")]
unsafe fn read_stream_to_end(
    stream: &windows::Win32::System::Com::IStream,
) -> Result<Vec<u8>, HostError> {
    use windows::Win32::System::Com::STREAM_SEEK_SET;

    stream
        .Seek(0, STREAM_SEEK_SET, None)
        .map_err(HostError::platform)?;
    let mut bytes = Vec::new();
    let mut chunk = [0u8; 64 * 1024];
    loop {
        let mut read = 0u32;
        let hr = stream.Read(chunk.as_mut_ptr().cast(), chunk.len() as u32, Some(&mut read));
        if hr.is_err() {
            return Err(HostError::Platform(format!(
                "Reading the snapshot stream failed: {hr}"
            )));
        }
        if read == 0 {
            break;
        }
        bytes.extend_from_slice(&chunk[..read as usize]);
    }
    Ok(bytes)
}

#[cfg(target_os = "macos")]
fn platform_snapshot(platform: tauri::webview::PlatformWebview, tx: SnapshotSender) {
    use objc2_app_kit::{NSBitmapImageFileType, NSBitmapImageRep, NSImage};
    use objc2_foundation::{NSDictionary, NSError};
    use objc2_web_kit::WKWebView;

    let block = block2::RcBlock::new(move |image: *mut NSImage, _error: *mut NSError| {
        // SAFETY: WebKit hands the completion block a live NSImage (or nil)
        // on the main thread; it is only borrowed for the duration of the
        // block invocation.
        let png = unsafe { image.as_ref() }
            .ok_or_else(|| HostError::Platform("The page snapshot returned no image.".into()))
            .and_then(|image| {
                let tiff = image.TIFFRepresentation().ok_or_else(|| {
                    HostError::Platform("Snapshot image has no TIFF representation.".into())
                })?;
                let rep = NSBitmapImageRep::imageRepWithData(&tiff).ok_or_else(|| {
                    HostError::Platform("Snapshot image could not be decoded.".into())
                })?;
                let data = unsafe {
                    rep.representationUsingType_properties(
                        NSBitmapImageFileType::PNG,
                        &NSDictionary::new(),
                    )
                }
                .ok_or_else(|| HostError::Platform("Snapshot PNG encoding failed.".into()))?;
                Ok(data.to_vec())
            });
        let _ = tx.send(png);
    });
    // SAFETY: `inner()` is the WKWebView of a live Tauri child webview; this
    // closure runs on the main thread (with_webview contract).
    unsafe {
        let view: &WKWebView = &*platform.inner().cast();
        view.takeSnapshotWithConfiguration_completionHandler(None, &block);
    }
}
