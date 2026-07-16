//! Agent viewport support: URL validation and the loopback file server that
//! lets workspace files render in the drawer's embedded webview.
//!
//! The webview itself is owned by the embedded webview manager
//! (`crate::embedded_webview`, label "agent-browser"); observations run
//! against that same visible webview via `embedded_webview_observe`. This
//! module only resolves workspace files to servable URLs:
//!
//! - Only http/https URLs load in embedded webviews; `file://`,
//!   `javascript:` and custom schemes are refused (`validate_url`).
//! - Workspace files are served over a loopback HTTP server so every page in
//!   the viewport is a *remote* origin: remote origins never reach Tauri app
//!   commands without an explicit remote capability, which we do not grant.

use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, Url};
use tokio::io::{AsyncReadExt, AsyncWriteExt};

#[derive(Default)]
pub struct ViewportState {
    server_port: tokio::sync::Mutex<Option<u16>>,
    file_root: Mutex<Option<PathBuf>>,
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

/// Resolve a workspace file to a loopback URL the embedded webview can load.
/// Starts the file server on first use; does not open any webview.
#[tauri::command]
pub async fn agent_viewport_serve_file(
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
    Ok(url.to_string())
}

/// Stop serving workspace files (e.g. when the preview session ends).
#[tauri::command]
pub async fn agent_viewport_stop_serving(app: AppHandle) -> Result<(), String> {
    *app.state::<ViewportState>()
        .file_root
        .lock()
        .unwrap_or_else(|e| e.into_inner()) = None;
    Ok(())
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
