//! Embedded webview manager: a single Rust-owned abstraction for the
//! lifecycle, bounds, visibility and z-order of native webviews embedded in
//! the main window, keyed by label.
//!
//! Native webviews always composite above the UI webview's HTML (the
//! WebView2/WKWebView "airspace" constraint), so overlapping UI cannot render
//! on top of them. The frontend compensates by snapshotting the page
//! (`embedded_webview_snapshot`), showing the snapshot in its placeholder and
//! hiding the native webview while an overlay is open.
//!
//! Platform code lives behind the `WebviewHost` trait (`host.rs`):
//! - macOS/Windows: Tauri child webviews (`child_host.rs`)
//! - Linux: raw wry webviews in the shared GtkFixed overlay (`gtk_host.rs`)
//!
//! IPC types (`WebviewBounds`, `EmbeddedWebviewError`, `EmbeddedWebviewEvent`)
//! are exported to TypeScript via ts-rs into
//! `src/features/embedded-webview/generated/` (run `cargo test export_bindings`).

pub mod host;

#[cfg(not(target_os = "linux"))]
pub mod child_host;
#[cfg(target_os = "linux")]
pub mod gtk_host;

use crate::agent_viewport::validate_url;
use host::{HostError, WebviewHost, ZOrder};
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::fmt::{Display, Formatter, Result as FmtResult};
use std::sync::Mutex;
use tauri::{AppHandle, Emitter, Manager};
use ts_rs::TS;

pub const EMBEDDED_WEBVIEW_EVENT: &str = "embedded-webview-event";

/// Logical (CSS) pixels relative to the main window's top-left corner.
#[derive(Debug, Clone, Copy, PartialEq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../src/features/embedded-webview/generated/")]
pub struct WebviewBounds {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

/// Normalized command error. Serialized with a `kind` discriminant so the
/// frontend can branch (e.g. `unsupported` → hide without a snapshot).
#[derive(Debug, Clone, Serialize, TS)]
#[serde(tag = "kind", content = "message", rename_all = "camelCase")]
#[ts(export, export_to = "../../src/features/embedded-webview/generated/")]
pub enum EmbeddedWebviewError {
    LabelTaken(String),
    NotFound(String),
    InvalidLabel(String),
    InvalidUrl(String),
    Unsupported(String),
    Platform(String),
}

impl Display for EmbeddedWebviewError {
    fn fmt(&self, f: &mut Formatter<'_>) -> FmtResult {
        match self {
            EmbeddedWebviewError::LabelTaken(msg)
            | EmbeddedWebviewError::NotFound(msg)
            | EmbeddedWebviewError::InvalidLabel(msg)
            | EmbeddedWebviewError::InvalidUrl(msg)
            | EmbeddedWebviewError::Unsupported(msg)
            | EmbeddedWebviewError::Platform(msg) => write!(f, "{msg}"),
        }
    }
}

impl From<HostError> for EmbeddedWebviewError {
    fn from(e: HostError) -> Self {
        match e {
            HostError::Unsupported(msg) => EmbeddedWebviewError::Unsupported(msg),
            HostError::Platform(msg) => EmbeddedWebviewError::Platform(msg),
        }
    }
}

#[derive(Debug, Clone, Serialize, TS)]
#[serde(tag = "kind", rename_all = "camelCase")]
#[ts(export, export_to = "../../src/features/embedded-webview/generated/")]
pub enum EmbeddedWebviewEventKind {
    TitleChanged { title: String },
    UrlChanged { url: String },
    LoadStarted { url: String },
    LoadFinished { url: String },
}

#[derive(Debug, Clone, Serialize, TS)]
#[ts(export, export_to = "../../src/features/embedded-webview/generated/")]
pub struct EmbeddedWebviewEvent {
    pub label: String,
    pub event: EmbeddedWebviewEventKind,
}

/// Emit a page event for an embedded webview. Called by host backends from
/// their platform hooks (page load, title change, navigation).
pub(crate) fn emit_event(app: &AppHandle, label: &str, event: EmbeddedWebviewEventKind) {
    let _ = app.emit(
        EMBEDDED_WEBVIEW_EVENT,
        EmbeddedWebviewEvent {
            label: label.to_string(),
            event,
        },
    );
}

/// Owns embedded webviews keyed by label. Label bookkeeping and validation
/// live here; platform work is delegated to the injected `WebviewHost`.
pub struct EmbeddedWebviews {
    host: Box<dyn WebviewHost>,
    labels: Mutex<HashSet<String>>,
}

fn validate_label(label: &str) -> Result<(), EmbeddedWebviewError> {
    let valid = !label.is_empty()
        && label
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_');
    if valid {
        Ok(())
    } else {
        Err(EmbeddedWebviewError::InvalidLabel(format!(
            "Invalid webview label {label:?}: use only letters, digits, '-' and '_'."
        )))
    }
}

impl EmbeddedWebviews {
    pub fn new(host: Box<dyn WebviewHost>) -> Self {
        Self {
            host,
            labels: Mutex::new(HashSet::new()),
        }
    }

    fn labels(&self) -> std::sync::MutexGuard<'_, HashSet<String>> {
        self.labels.lock().unwrap_or_else(|e| e.into_inner())
    }

    fn require(&self, label: &str) -> Result<(), EmbeddedWebviewError> {
        if self.labels().contains(label) {
            Ok(())
        } else {
            Err(EmbeddedWebviewError::NotFound(format!(
                "No embedded webview with label {label:?}."
            )))
        }
    }

    pub fn create(
        &self,
        label: &str,
        url: &str,
        bounds: WebviewBounds,
    ) -> Result<(), EmbeddedWebviewError> {
        validate_label(label)?;
        let url = validate_url(url).map_err(EmbeddedWebviewError::InvalidUrl)?;
        // Hold the lock across the host call so racing creates for the same
        // label cannot both reach the platform.
        let mut labels = self.labels();
        if labels.contains(label) {
            return Err(EmbeddedWebviewError::LabelTaken(format!(
                "An embedded webview with label {label:?} already exists."
            )));
        }
        self.host.create(label, &url, bounds)?;
        labels.insert(label.to_string());
        Ok(())
    }

    pub fn navigate(&self, label: &str, url: &str) -> Result<(), EmbeddedWebviewError> {
        let url = validate_url(url).map_err(EmbeddedWebviewError::InvalidUrl)?;
        self.require(label)?;
        Ok(self.host.navigate(label, &url)?)
    }

    pub fn reload(&self, label: &str) -> Result<(), EmbeddedWebviewError> {
        self.require(label)?;
        Ok(self.host.reload(label)?)
    }

    pub fn set_bounds(
        &self,
        label: &str,
        bounds: WebviewBounds,
    ) -> Result<(), EmbeddedWebviewError> {
        self.require(label)?;
        Ok(self.host.set_bounds(label, bounds)?)
    }

    pub fn set_visible(&self, label: &str, visible: bool) -> Result<(), EmbeddedWebviewError> {
        self.require(label)?;
        Ok(self.host.set_visible(label, visible)?)
    }

    #[allow(dead_code)] // command surface is create/bounds/visible/navigate/snapshot/destroy; z-order is trait-level for the composition backend
    pub fn set_z_order(&self, label: &str, z_order: ZOrder) -> Result<(), EmbeddedWebviewError> {
        self.require(label)?;
        Ok(self.host.set_z_order(label, z_order)?)
    }

    pub fn snapshot(&self, label: &str) -> Result<Vec<u8>, EmbeddedWebviewError> {
        self.require(label)?;
        Ok(self.host.snapshot(label)?)
    }

    pub fn destroy(&self, label: &str) -> Result<(), EmbeddedWebviewError> {
        self.require(label)?;
        // Free the label even if the platform teardown fails, so a stuck
        // native view can't wedge the label forever.
        self.labels().remove(label);
        Ok(self.host.destroy(label)?)
    }
}

// ─── Commands ───

#[tauri::command]
pub async fn embedded_webview_create(
    app: AppHandle,
    label: String,
    url: String,
    bounds: WebviewBounds,
) -> Result<(), EmbeddedWebviewError> {
    app.state::<EmbeddedWebviews>().create(&label, &url, bounds)
}

#[tauri::command]
pub async fn embedded_webview_navigate(
    app: AppHandle,
    label: String,
    url: String,
) -> Result<(), EmbeddedWebviewError> {
    app.state::<EmbeddedWebviews>().navigate(&label, &url)
}

#[tauri::command]
pub async fn embedded_webview_reload(
    app: AppHandle,
    label: String,
) -> Result<(), EmbeddedWebviewError> {
    app.state::<EmbeddedWebviews>().reload(&label)
}

#[tauri::command]
pub async fn embedded_webview_set_bounds(
    app: AppHandle,
    label: String,
    bounds: WebviewBounds,
) -> Result<(), EmbeddedWebviewError> {
    app.state::<EmbeddedWebviews>().set_bounds(&label, bounds)
}

#[tauri::command]
pub async fn embedded_webview_set_visible(
    app: AppHandle,
    label: String,
    visible: bool,
) -> Result<(), EmbeddedWebviewError> {
    app.state::<EmbeddedWebviews>().set_visible(&label, visible)
}

/// Capture the page as PNG. Returned as a raw IPC response (binary body), not
/// JSON, so multi-megabyte captures skip serialization; the frontend receives
/// an ArrayBuffer and wraps it in a Blob URL.
#[tauri::command]
pub async fn embedded_webview_snapshot(
    app: AppHandle,
    label: String,
) -> Result<tauri::ipc::Response, EmbeddedWebviewError> {
    let png = app.state::<EmbeddedWebviews>().snapshot(&label)?;
    Ok(tauri::ipc::Response::new(png))
}

#[tauri::command]
pub async fn embedded_webview_destroy(
    app: AppHandle,
    label: String,
) -> Result<(), EmbeddedWebviewError> {
    app.state::<EmbeddedWebviews>().destroy(&label)
}

// ─── Tests ───

#[cfg(test)]
mod tests {
    use super::host::{HostError, WebviewHost, ZOrder};
    use super::{EmbeddedWebviewError, EmbeddedWebviews, WebviewBounds};
    use std::sync::Mutex;
    use tauri::Url;

    #[derive(Default)]
    struct StubHost {
        calls: Mutex<Vec<String>>,
        fail_snapshot: bool,
    }

    impl StubHost {
        fn log(&self, call: impl Into<String>) {
            self.calls
                .lock()
                .unwrap_or_else(|e| e.into_inner())
                .push(call.into());
        }
    }

    impl WebviewHost for StubHost {
        fn create(&self, label: &str, url: &Url, _: WebviewBounds) -> Result<(), HostError> {
            self.log(format!("create {label} {url}"));
            Ok(())
        }
        fn navigate(&self, label: &str, url: &Url) -> Result<(), HostError> {
            self.log(format!("navigate {label} {url}"));
            Ok(())
        }
        fn reload(&self, label: &str) -> Result<(), HostError> {
            self.log(format!("reload {label}"));
            Ok(())
        }
        fn set_bounds(&self, label: &str, b: WebviewBounds) -> Result<(), HostError> {
            self.log(format!("bounds {label} {}x{}", b.width, b.height));
            Ok(())
        }
        fn set_visible(&self, label: &str, visible: bool) -> Result<(), HostError> {
            self.log(format!("visible {label} {visible}"));
            Ok(())
        }
        fn set_z_order(&self, _: &str, _: ZOrder) -> Result<(), HostError> {
            Err(HostError::Unsupported("no z-order in stub".into()))
        }
        fn snapshot(&self, label: &str) -> Result<Vec<u8>, HostError> {
            if self.fail_snapshot {
                return Err(HostError::Unsupported("no snapshots here".into()));
            }
            self.log(format!("snapshot {label}"));
            Ok(vec![1, 2, 3])
        }
        fn destroy(&self, label: &str) -> Result<(), HostError> {
            self.log(format!("destroy {label}"));
            Ok(())
        }
    }

    fn manager() -> EmbeddedWebviews {
        EmbeddedWebviews::new(Box::new(StubHost::default()))
    }

    const BOUNDS: WebviewBounds = WebviewBounds {
        x: 0.0,
        y: 0.0,
        width: 100.0,
        height: 100.0,
    };

    #[test]
    fn create_rejects_duplicate_labels() {
        let m = manager();
        m.create("page", "https://example.com", BOUNDS).unwrap();
        assert!(matches!(
            m.create("page", "https://example.com", BOUNDS),
            Err(EmbeddedWebviewError::LabelTaken(_))
        ));
    }

    #[test]
    fn create_validates_label_and_url() {
        let m = manager();
        assert!(matches!(
            m.create("bad label!", "https://example.com", BOUNDS),
            Err(EmbeddedWebviewError::InvalidLabel(_))
        ));
        assert!(matches!(
            m.create("", "https://example.com", BOUNDS),
            Err(EmbeddedWebviewError::InvalidLabel(_))
        ));
        assert!(matches!(
            m.create("page", "javascript:alert(1)", BOUNDS),
            Err(EmbeddedWebviewError::InvalidUrl(_))
        ));
        // Nothing reached the host on failure.
        assert!(matches!(
            m.set_bounds("page", BOUNDS),
            Err(EmbeddedWebviewError::NotFound(_))
        ));
    }

    #[test]
    fn operations_on_unknown_labels_are_not_found() {
        let m = manager();
        assert!(matches!(
            m.navigate("ghost", "https://example.com"),
            Err(EmbeddedWebviewError::NotFound(_))
        ));
        assert!(matches!(
            m.set_visible("ghost", false),
            Err(EmbeddedWebviewError::NotFound(_))
        ));
        assert!(matches!(
            m.snapshot("ghost"),
            Err(EmbeddedWebviewError::NotFound(_))
        ));
        assert!(matches!(
            m.destroy("ghost"),
            Err(EmbeddedWebviewError::NotFound(_))
        ));
    }

    #[test]
    fn destroy_frees_the_label_for_reuse() {
        let m = manager();
        m.create("page", "https://example.com", BOUNDS).unwrap();
        m.destroy("page").unwrap();
        assert!(matches!(
            m.set_visible("page", true),
            Err(EmbeddedWebviewError::NotFound(_))
        ));
        m.create("page", "https://example.com", BOUNDS).unwrap();
    }

    #[test]
    fn navigate_revalidates_urls() {
        let m = manager();
        m.create("page", "https://example.com", BOUNDS).unwrap();
        assert!(matches!(
            m.navigate("page", "file:///etc/passwd"),
            Err(EmbeddedWebviewError::InvalidUrl(_))
        ));
    }

    #[test]
    fn unsupported_host_errors_keep_their_kind() {
        let m = EmbeddedWebviews::new(Box::new(StubHost {
            fail_snapshot: true,
            ..Default::default()
        }));
        m.create("page", "https://example.com", BOUNDS).unwrap();
        assert!(matches!(
            m.snapshot("page"),
            Err(EmbeddedWebviewError::Unsupported(_))
        ));
    }
}
