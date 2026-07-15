//! Platform seam for embedded webviews.
//!
//! The manager (`super::EmbeddedWebviews`) owns label bookkeeping and
//! validation; everything platform-specific goes through this trait. The
//! current backends embed native child webviews (`child_host` on
//! macOS/Windows, `gtk_host` on Linux). A future Windows
//! composition-hosting/DirectComposition backend implements this same trait —
//! including real z-ordering — without changing the command signatures or the
//! frontend contract.

use super::WebviewBounds;
use tauri::Url;

/// Stacking order among embedded webviews. Native child webviews always
/// composite above the UI webview's HTML (the airspace constraint); this only
/// orders embedded webviews relative to each other.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
#[allow(dead_code)] // no command drives z-order yet; the variants exist so the composition backend lands without a trait change
pub enum ZOrder {
    Front,
    Back,
}

/// Errors surfaced by a host backend. The manager wraps these into
/// `EmbeddedWebviewError`, preserving the `Unsupported` kind so the frontend
/// can fall back (e.g. hide-without-snapshot when snapshots are unavailable).
#[derive(Debug)]
pub enum HostError {
    /// The operation is not implemented on this platform/backend.
    Unsupported(String),
    /// The platform call failed.
    Platform(String),
}

impl HostError {
    pub fn platform(e: impl std::fmt::Display) -> Self {
        HostError::Platform(e.to_string())
    }
}

/// One embedded webview backend. Implementations key webviews by the caller's
/// label (already validated and namespaced by the manager). All bounds are
/// logical (CSS) pixels relative to the main window's top-left corner.
pub trait WebviewHost: Send + Sync + 'static {
    fn create(&self, label: &str, url: &Url, bounds: WebviewBounds) -> Result<(), HostError>;
    fn navigate(&self, label: &str, url: &Url) -> Result<(), HostError>;
    fn set_bounds(&self, label: &str, bounds: WebviewBounds) -> Result<(), HostError>;
    fn set_visible(&self, label: &str, visible: bool) -> Result<(), HostError>;
    fn set_z_order(&self, label: &str, z_order: ZOrder) -> Result<(), HostError>;
    /// Capture the current page as PNG bytes. Blocks (with an internal
    /// timeout) until the platform capture completes.
    fn snapshot(&self, label: &str) -> Result<Vec<u8>, HostError>;
    fn destroy(&self, label: &str) -> Result<(), HostError>;
}
