import { invoke } from "@tauri-apps/api/core";
import type { WebviewBounds } from "./generated/WebviewBounds";

/**
 * Invoke wrappers for the Rust embedded webview manager
 * (src-tauri/src/embedded_webview). Bounds are logical (CSS) pixels relative
 * to the window's top-left corner. Command errors reject with a serialized
 * `EmbeddedWebviewError` (see ./generated).
 */

export function embeddedWebviewCreate(label: string, url: string, bounds: WebviewBounds): Promise<void> {
  return invoke("embedded_webview_create", { label, url, bounds });
}

export function embeddedWebviewNavigate(label: string, url: string): Promise<void> {
  return invoke("embedded_webview_navigate", { label, url });
}

export function embeddedWebviewReload(label: string): Promise<void> {
  return invoke("embedded_webview_reload", { label });
}

export function embeddedWebviewSetBounds(label: string, bounds: WebviewBounds): Promise<void> {
  return invoke("embedded_webview_set_bounds", { label, bounds });
}

export function embeddedWebviewSetVisible(label: string, visible: boolean): Promise<void> {
  return invoke("embedded_webview_set_visible", { label, visible });
}

export function embeddedWebviewDestroy(label: string): Promise<void> {
  return invoke("embedded_webview_destroy", { label });
}

/** Run the injected collector in the page and return its observation JSON. */
export function embeddedWebviewObserve(
  label: string,
  kind: "snapshot" | "inspect",
  selector?: string,
): Promise<unknown> {
  return invoke("embedded_webview_observe", { label, kind, selector: selector ?? null });
}

/**
 * Capture the page as PNG. The command returns a raw binary IPC response
 * (ArrayBuffer), wrapped here into an object URL for direct use as an <img>
 * src. Callers own the URL and must revoke it.
 */
export async function embeddedWebviewSnapshotUrl(label: string): Promise<string> {
  const buffer = await invoke<ArrayBuffer>("embedded_webview_snapshot", { label });
  return URL.createObjectURL(new Blob([buffer], { type: "image/png" }));
}
