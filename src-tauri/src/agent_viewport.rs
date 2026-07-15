//! Agent viewport: a native WebView embedded in the main window (right-side
//! drawer) that the agent opens as a visual inspection surface.
//!
//! - macOS/Windows: a child webview of the main window (`Window::add_child`).
//! - Linux: Tauri's `add_child` packs children into the window's GtkBox, which
//!   splits the layout vertically and makes `set_bounds` a no-op, so the
//!   webview is built directly with wry inside a GtkFixed overlaid on the
//!   window content (`mod embed`). wry positions webviews correctly inside a
//!   GtkFixed, and as a raw wry webview it receives no Tauri IPC or plugin
//!   shims at all.
//! - Only http/https URLs load; `file://`, `javascript:` and custom schemes
//!   are refused.
//! - Workspace files are served over a loopback HTTP server so every page in
//!   the viewport is a *remote* origin: remote origins never reach Tauri app
//!   commands without an explicit remote capability, which we do not grant.
//! - Observations are pulled by evaluating the injected collector script and
//!   reading its return value; pages cannot push anything into the app.
//! - Cookies/session live in the app's own WebView profile, isolated from
//!   the user's normal browser.

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager, Url};
#[cfg(not(target_os = "linux"))]
use tauri::{
    webview::PageLoadEvent, LogicalPosition, LogicalSize, Rect, WebviewUrl, Window,
};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[cfg(not(target_os = "linux"))]
pub const VIEWPORT_LABEL: &str = "agent-viewport";
const STATUS_EVENT: &str = "agent-viewport-status";
const OBSERVE_TIMEOUT: Duration = Duration::from_secs(5);
const COLLECTOR_SCRIPT: &str = include_str!("agent_viewport_collector.js");

/// Tauri plugin shims (e.g. Notification) are injected into child webviews
/// but have no IPC permission there; replace them with an inert
/// standard-shaped API so remote pages don't hit capability rejections.
#[cfg(not(target_os = "linux"))]
pub(crate) const NOTIFICATION_STUB: &str = r#"(() => {
  try {
    const inert = function Notification() { throw new TypeError("Notifications are disabled in this viewport."); };
    inert.permission = "denied";
    inert.requestPermission = () => Promise.resolve("denied");
    Object.defineProperty(window, "Notification", { value: inert, configurable: true });
  } catch (_) { /* leave the page's own API untouched */ }
})();"#;

#[derive(Default)]
pub struct ViewportState {
    server_port: tokio::sync::Mutex<Option<u16>>,
    file_root: Mutex<Option<PathBuf>>,
}

#[derive(Clone, serde::Serialize)]
struct ViewportStatus {
    url: String,
    phase: &'static str, // "loading" | "ready" | "closed"
}

fn emit_status(app: &AppHandle, url: String, phase: &'static str) {
    let _ = app.emit(STATUS_EVENT, ViewportStatus { url, phase });
}

pub(crate) fn validate_url(raw: &str) -> Result<Url, String> {
    let url = Url::parse(raw).map_err(|e| format!("Invalid URL: {e}"))?;
    match url.scheme() {
        "http" | "https" => Ok(url),
        scheme => Err(format!(
            "Blocked URL scheme \"{scheme}\": only http and https are allowed."
        )),
    }
}

// ─── Embedded webview backend: macOS/Windows (Tauri child webview) ───

#[cfg(not(target_os = "linux"))]
fn main_window(app: &AppHandle) -> Result<Window, String> {
    app.get_window("main")
        .ok_or("Main window not found.".to_string())
}

#[cfg(not(target_os = "linux"))]
fn viewport(app: &AppHandle) -> Option<tauri::Webview> {
    app.webviews().remove(VIEWPORT_LABEL)
}

#[cfg(not(target_os = "linux"))]
fn open_in_viewport(app: &AppHandle, url: Url) -> Result<(), String> {
    if let Some(existing) = viewport(app) {
        emit_status(app, url.to_string(), "loading");
        existing.navigate(url).map_err(|e| e.to_string())?;
        return Ok(());
    }

    let load_handle = app.clone();
    let builder =
        tauri::webview::WebviewBuilder::new(VIEWPORT_LABEL, WebviewUrl::External(url.clone()))
            .initialization_script(NOTIFICATION_STUB)
            .initialization_script(COLLECTOR_SCRIPT)
            .on_page_load(move |_webview, payload| {
                let phase = match payload.event() {
                    PageLoadEvent::Started => "loading",
                    PageLoadEvent::Finished => "ready",
                };
                emit_status(&load_handle, payload.url().to_string(), phase);
            });

    // Created off-screen sized 1x1; the drawer reports real bounds right after
    // it mounts via agent_viewport_set_bounds.
    let webview = main_window(app)?
        .add_child(
            builder,
            LogicalPosition::new(0.0, 0.0),
            LogicalSize::new(1.0, 1.0),
        )
        .map_err(|e| e.to_string())?;
    let _ = webview.hide();
    emit_status(app, url.to_string(), "loading");
    Ok(())
}

#[cfg(not(target_os = "linux"))]
async fn eval_viewport(app: &AppHandle, js: String) -> Result<String, String> {
    let webview = viewport(app).ok_or("No viewport is open.")?;
    let (tx, rx) = tokio::sync::oneshot::channel::<String>();
    let tx = Mutex::new(Some(tx));
    webview
        .eval_with_callback(js, move |result| {
            if let Some(tx) = tx.lock().unwrap_or_else(|e| e.into_inner()).take() {
                let _ = tx.send(result);
            }
        })
        .map_err(|e| e.to_string())?;
    await_eval(rx).await
}

async fn await_eval(rx: tokio::sync::oneshot::Receiver<String>) -> Result<String, String> {
    tokio::time::timeout(OBSERVE_TIMEOUT, rx)
        .await
        .map_err(|_| "The page did not respond in time; it may still be loading.".to_string())?
        .map_err(|_| "Observation was cancelled.".to_string())
}

// ─── Embedded webview backend: Linux (wry webview in a GtkFixed overlay) ───

#[cfg(target_os = "linux")]
mod embed {
    use super::{await_eval, emit_status, COLLECTOR_SCRIPT};
    use crate::gtk_overlay::{ensure_fixed, on_main};
    use gtk::prelude::*;
    use std::cell::RefCell;
    use std::sync::Mutex;
    use tauri::AppHandle;
    use wry::{WebViewBuilderExtUnix, WebViewExtUnix};

    // GTK objects are main-thread only; every entry point below hops onto the
    // GTK main thread via `on_main` and the state lives in thread-locals. The
    // GtkFixed layer itself is shared with the embedded webview manager (see
    // crate::gtk_overlay).
    thread_local! {
        static WEBVIEW: RefCell<Option<wry::WebView>> = const { RefCell::new(None) };
    }

    pub fn open(app: &AppHandle, url: String) -> Result<(), String> {
        let handle = app.clone();
        on_main(app, move || -> Result<(), String> {
            let navigated = WEBVIEW.with(|cell| {
                cell.borrow()
                    .as_ref()
                    .map(|webview| webview.load_url(&url).map_err(|e| e.to_string()))
            });
            if let Some(result) = navigated {
                result?;
                emit_status(&handle, url, "loading");
                return Ok(());
            }

            let fixed = ensure_fixed(&handle)?;
            let status_handle = handle.clone();
            let webview = wry::WebViewBuilder::new()
                .with_url(&url)
                .with_initialization_script(COLLECTOR_SCRIPT)
                .with_visible(false)
                .with_bounds(bounds_rect(0.0, 0.0, 1.0, 1.0))
                .with_on_page_load_handler(move |event, page_url| {
                    let phase = match event {
                        wry::PageLoadEvent::Started => "loading",
                        wry::PageLoadEvent::Finished => "ready",
                    };
                    emit_status(&status_handle, page_url, phase);
                })
                .build_gtk(&fixed)
                .map_err(|e| e.to_string())?;
            WEBVIEW.with(|cell| *cell.borrow_mut() = Some(webview));
            emit_status(&handle, url, "loading");
            Ok(())
        })?
    }

    pub fn set_bounds(
        app: &AppHandle,
        x: f64,
        y: f64,
        width: f64,
        height: f64,
    ) -> Result<(), String> {
        let handle = app.clone();
        on_main(app, move || {
            WEBVIEW.with(|cell| {
                let borrow = cell.borrow();
                let Some(webview) = borrow.as_ref() else {
                    return Ok(());
                };
                // Persist geometry in GTK too, so window re-layouts don't
                // snap the widget back to its creation size.
                if let Ok(fixed) = ensure_fixed(&handle) {
                    let widget = WebViewExtUnix::webview(webview);
                    fixed.move_(&widget, x as i32, y as i32);
                    widget.set_size_request(width as i32, height as i32);
                }
                webview
                    .set_bounds(bounds_rect(x, y, width, height))
                    .map_err(|e| e.to_string())?;
                webview.set_visible(true).map_err(|e| e.to_string())
            })
        })?
    }

    pub fn set_visible(app: &AppHandle, visible: bool) -> Result<(), String> {
        on_main(app, move || {
            WEBVIEW.with(|cell| match cell.borrow().as_ref() {
                Some(webview) => webview.set_visible(visible).map_err(|e| e.to_string()),
                None => Ok(()),
            })
        })?
    }

    pub fn reload(app: &AppHandle) -> Result<(), String> {
        on_main(app, || {
            WEBVIEW.with(|cell| match cell.borrow().as_ref() {
                Some(webview) => webview.reload().map_err(|e| e.to_string()),
                None => Err("No viewport is open.".to_string()),
            })
        })?
    }

    /// Returns whether a webview existed and was destroyed.
    pub fn close(app: &AppHandle) -> Result<bool, String> {
        let handle = app.clone();
        on_main(app, move || {
            let Some(webview) = WEBVIEW.with(|cell| cell.borrow_mut().take()) else {
                return false;
            };
            if let Ok(fixed) = ensure_fixed(&handle) {
                fixed.remove(&WebViewExtUnix::webview(&webview));
            }
            drop(webview);
            true
        })
    }

    pub async fn eval(app: &AppHandle, js: String) -> Result<String, String> {
        let (tx, rx) = tokio::sync::oneshot::channel::<String>();
        let tx = Mutex::new(Some(tx));
        on_main(app, move || {
            WEBVIEW.with(|cell| {
                let borrow = cell.borrow();
                let Some(webview) = borrow.as_ref() else {
                    return Err("No viewport is open.".to_string());
                };
                webview
                    .evaluate_script_with_callback(&js, move |result| {
                        if let Some(tx) = tx.lock().unwrap_or_else(|e| e.into_inner()).take() {
                            let _ = tx.send(result);
                        }
                    })
                    .map_err(|e| e.to_string())
            })
        })??;
        await_eval(rx).await
    }

    fn bounds_rect(x: f64, y: f64, width: f64, height: f64) -> wry::Rect {
        wry::Rect {
            position: wry::dpi::LogicalPosition::new(x, y).into(),
            size: wry::dpi::LogicalSize::new(width, height).into(),
        }
    }
}

// ─── Commands ───

#[tauri::command]
pub async fn agent_viewport_open(app: AppHandle, url: String) -> Result<String, String> {
    let parsed = validate_url(&url)?;
    let visible_url = parsed.to_string();
    #[cfg(target_os = "linux")]
    embed::open(&app, visible_url.clone())?;
    #[cfg(not(target_os = "linux"))]
    open_in_viewport(&app, parsed)?;
    Ok(visible_url)
}

#[tauri::command]
pub async fn agent_viewport_open_file(
    app: AppHandle,
    workspace_path: String,
    path: String,
) -> Result<String, String> {
    let root = Path::new(&workspace_path)
        .canonicalize()
        .map_err(|e| format!("Workspace not accessible: {e}"))?;
    let file = root
        .join(path.trim_start_matches(['/', '\\']))
        .canonicalize()
        .map_err(|_| format!("File not found in workspace: {path}"))?;
    if !file.starts_with(&root) {
        return Err(format!("Refused: \"{path}\" is outside the workspace."));
    }
    if !file.is_file() {
        return Err(format!("Not a file: {path}"));
    }

    let state = app.state::<ViewportState>();
    *state.file_root.lock().unwrap_or_else(|e| e.into_inner()) = Some(root.clone());
    let port = ensure_file_server(&app).await?;

    let rel = file
        .strip_prefix(&root)
        .map_err(|_| "Path invariant violated: strip_prefix after starts_with")?
        .to_string_lossy()
        .replace('\\', "/");
    let url = Url::parse(&format!("http://127.0.0.1:{port}/{rel}"))
        .map_err(|e| format!("Invalid preview URL: {e}"))?;
    let visible_url = url.to_string();
    #[cfg(target_os = "linux")]
    embed::open(&app, visible_url.clone())?;
    #[cfg(not(target_os = "linux"))]
    open_in_viewport(&app, url)?;
    Ok(visible_url)
}

#[tauri::command]
pub async fn agent_viewport_set_bounds(
    app: AppHandle,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let (x, y) = (x.max(0.0), y.max(0.0));
    let (width, height) = (width.max(1.0), height.max(1.0));
    #[cfg(target_os = "linux")]
    return embed::set_bounds(&app, x, y, width, height);
    #[cfg(not(target_os = "linux"))]
    {
        let Some(webview) = viewport(&app) else {
            return Ok(());
        };
        webview
            .set_bounds(Rect {
                position: LogicalPosition::new(x, y).into(),
                size: LogicalSize::new(width, height).into(),
            })
            .map_err(|e| e.to_string())?;
        webview.show().map_err(|e| e.to_string())
    }
}

#[tauri::command]
pub async fn agent_viewport_hide(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    return embed::set_visible(&app, false);
    #[cfg(not(target_os = "linux"))]
    {
        if let Some(webview) = viewport(&app) {
            webview.hide().map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}

#[tauri::command]
pub async fn agent_viewport_close(app: AppHandle) -> Result<(), String> {
    *app.state::<ViewportState>().file_root.lock().unwrap_or_else(|e| e.into_inner()) = None;
    #[cfg(target_os = "linux")]
    {
        if embed::close(&app)? {
            emit_status(&app, String::new(), "closed");
        }
        Ok(())
    }
    #[cfg(not(target_os = "linux"))]
    {
        if let Some(webview) = viewport(&app) {
            webview.close().map_err(|e| e.to_string())?;
            emit_status(&app, String::new(), "closed");
        }
        Ok(())
    }
}

#[tauri::command]
pub async fn agent_viewport_reload(app: AppHandle) -> Result<(), String> {
    #[cfg(target_os = "linux")]
    return embed::reload(&app);
    #[cfg(not(target_os = "linux"))]
    {
        let webview = viewport(&app).ok_or("No viewport is open.")?;
        webview.reload().map_err(|e| e.to_string())
    }
}

/// Evaluate the collector in the page and return its observation JSON.
/// `kind` is "snapshot" or "inspect"; `selector` applies to inspect only.
#[tauri::command]
pub async fn agent_viewport_observe(
    app: AppHandle,
    kind: String,
    selector: Option<String>,
) -> Result<serde_json::Value, String> {
    if kind != "snapshot" && kind != "inspect" {
        return Err(format!("Unknown observe kind: {kind}"));
    }
    let selector_json = serde_json::to_string(&selector).map_err(|e| e.to_string())?;
    let js = format!(
        "(() => {{ try {{ return window.__POLY_OBSERVE__ ? window.__POLY_OBSERVE__({kind:?}, {selector_json}) : {{ error: \"Collector not loaded; the page may still be starting.\" }}; }} catch (e) {{ return {{ error: String(e) }}; }} }})()"
    );

    #[cfg(target_os = "linux")]
    let raw = embed::eval(&app, js).await?;
    #[cfg(not(target_os = "linux"))]
    let raw = eval_viewport(&app, js).await?;
    serde_json::from_str(&raw).map_err(|e| format!("Unreadable observation: {e}"))
}

// ─── Loopback file server ───

async fn ensure_file_server(app: &AppHandle) -> Result<u16, String> {
    let state = app.state::<ViewportState>();
    let mut port = state.server_port.lock().await;
    if let Some(existing) = *port {
        return Ok(existing);
    }
    let listener = tokio::net::TcpListener::bind("127.0.0.1:0")
        .await
        .map_err(|e| format!("Preview server failed to start: {e}"))?;
    let bound = listener.local_addr().map_err(|e| e.to_string())?.port();
    *port = Some(bound);

    let handle = app.clone();
    tauri::async_runtime::spawn(async move {
        loop {
            let Ok((stream, _)) = listener.accept().await else {
                break;
            };
            let root = handle
                .state::<ViewportState>()
                .file_root
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .clone();
            tauri::async_runtime::spawn(serve_connection(stream, root));
        }
    });
    Ok(bound)
}

async fn serve_connection(mut stream: tokio::net::TcpStream, root: Option<PathBuf>) {
    let mut buf = vec![0u8; 8192];
    let Ok(n) = stream.read(&mut buf).await else {
        return;
    };
    let head = String::from_utf8_lossy(&buf[..n]);
    let request_path = head
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .unwrap_or("/")
        .split(['?', '#'])
        .next()
        .unwrap_or("/")
        .to_string();
    let is_get = head.starts_with("GET ");

    let (status, mime, body): (&str, &str, Vec<u8>) = if !is_get {
        (
            "405 Method Not Allowed",
            "text/plain",
            b"Method not allowed.".to_vec(),
        )
    } else {
        match root
            .ok_or(403u16)
            .and_then(|root| resolve_file(&root, &request_path))
        {
            Ok(file) => match std::fs::read(&file) {
                Ok(bytes) => ("200 OK", mime_for(&file), bytes),
                Err(_) => ("404 Not Found", "text/plain", b"Not found.".to_vec()),
            },
            Err(403) => (
                "403 Forbidden",
                "text/plain",
                b"No preview session is active.".to_vec(),
            ),
            Err(_) => ("404 Not Found", "text/plain", b"Not found.".to_vec()),
        }
    };

    let header = format!(
        "HTTP/1.1 {status}\r\ncontent-type: {mime}\r\ncontent-length: {}\r\ncache-control: no-store\r\nconnection: close\r\n\r\n",
        body.len()
    );
    let _ = stream.write_all(header.as_bytes()).await;
    let _ = stream.write_all(&body).await;
    let _ = stream.shutdown().await;
}

/// Resolve a request path against the served root; anything escaping the
/// root (traversal, symlinks out) is refused.
fn resolve_file(root: &Path, uri_path: &str) -> Result<PathBuf, u16> {
    let decoded = percent_encoding::percent_decode_str(uri_path)
        .decode_utf8()
        .map_err(|_| 404u16)?;
    let candidate = root.join(decoded.trim_start_matches('/'));
    let file = candidate.canonicalize().map_err(|_| 404u16)?;
    if !file.starts_with(root) {
        return Err(404);
    }
    Ok(file)
}

fn mime_for(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_ascii_lowercase()
        .as_str()
    {
        "html" | "htm" => "text/html",
        "css" => "text/css",
        "js" | "mjs" => "text/javascript",
        "json" | "map" => "application/json",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "ico" => "image/x-icon",
        "txt" | "md" => "text/plain",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        "wasm" => "application/wasm",
        _ => "application/octet-stream",
    }
}

#[cfg(test)]
mod tests {
    use super::{resolve_file, validate_url};

    #[test]
    fn allows_http_and_https() {
        assert!(validate_url("http://localhost:3000").is_ok());
        assert!(validate_url("http://127.0.0.1:5173/app").is_ok());
        assert!(validate_url("https://example.com/docs").is_ok());
    }

    #[test]
    fn blocks_other_schemes() {
        for url in [
            "file:///etc/passwd",
            "ftp://host",
            "javascript:alert(1)",
            "data:text/html,x",
        ] {
            assert!(validate_url(url).is_err(), "{url} should be blocked");
        }
        assert!(validate_url("not a url").is_err());
    }

    #[test]
    fn served_files_stay_inside_root() {
        let dir = std::env::temp_dir().join("agent-viewport-test");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("index.html"), "<h1>hi</h1>").unwrap();
        let root = dir.canonicalize().unwrap();

        assert!(resolve_file(&root, "/index.html").is_ok());
        assert!(resolve_file(&root, "/index%2ehtml").is_ok());
        assert!(resolve_file(&root, "/../../etc/passwd").is_err());
        assert!(resolve_file(&root, "/%2e%2e/%2e%2e/etc/passwd").is_err());
        assert!(resolve_file(&root, "/missing.html").is_err());
    }
}
