import { create } from "zustand";
import * as native from "./native";
import type { EmbeddedWebviewEvent } from "./generated/EmbeddedWebviewEvent";
import type { WebviewBounds } from "./generated/WebviewBounds";

/**
 * State for embedded native webviews (src-tauri/src/embedded_webview) and the
 * overlay-hide mechanism.
 *
 * Native webviews always composite above the UI webview's HTML (the airspace
 * constraint), so any overlapping UI — dialogs, dropdowns, the command
 * palette, toasts — would render underneath the page. When the first such
 * overlay opens (`notifyOverlayOpened`), every mounted frame is "covered":
 * the page is snapshotted, the snapshot is shown inside the placeholder, and
 * the native webview is hidden. When the last overlay closes, the webview is
 * shown again and the snapshot is removed one frame later to avoid flicker.
 *
 * Platform calls go through an injectable bridge (mirroring the repository
 * seam in lib/repositories) so tests run without Tauri.
 */

export type EmbeddedFrameState = {
  label: string;
  /** Last page state reported by native events. */
  url: string | null;
  title: string | null;
  status: "loading" | "ready";
  /** True while an overlay hides the native webview. */
  covered: boolean;
  /** Object URL of the snapshot shown while covered. */
  snapshotUrl: string | null;
  /** Snapshot failed or is unsupported: show the neutral surface instead. */
  coverFallback: boolean;
};

type EmbeddedWebviewStore = {
  frames: Record<string, EmbeddedFrameState>;
  overlayCount: number;
  actions: {
    frameMounted: (label: string) => void;
    frameUnmounted: (label: string) => void;
    setOverlayCount: (overlayCount: number) => void;
    patchFrame: (label: string, patch: Partial<EmbeddedFrameState>) => void;
  };
};

export const useEmbeddedWebviewStore = create<EmbeddedWebviewStore>((set) => ({
  frames: {},
  overlayCount: 0,
  actions: {
    frameMounted: (label) =>
      set((state) => ({
        frames: {
          ...state.frames,
          [label]: {
            label,
            url: null,
            title: null,
            status: "loading",
            covered: false,
            snapshotUrl: null,
            coverFallback: false,
          },
        },
      })),
    frameUnmounted: (label) =>
      set((state) => {
        const { [label]: removed, ...frames } = state.frames;
        if (removed?.snapshotUrl) bridge.revokeSnapshot(removed.snapshotUrl);
        return { frames };
      }),
    setOverlayCount: (overlayCount) => set({ overlayCount }),
    patchFrame: (label, patch) =>
      set((state) => {
        const frame = state.frames[label];
        if (!frame) return state;
        return { frames: { ...state.frames, [label]: { ...frame, ...patch } } };
      }),
  },
}));

// ─── Bridge (injection seam for tests) ───

export type EmbeddedWebviewBridge = {
  create: (label: string, url: string, bounds: WebviewBounds) => Promise<void>;
  navigate: (label: string, url: string) => Promise<void>;
  setBounds: (label: string, bounds: WebviewBounds) => Promise<void>;
  setVisible: (label: string, visible: boolean) => Promise<void>;
  destroy: (label: string) => Promise<void>;
  /** Resolves to an object URL for the PNG snapshot. */
  snapshot: (label: string) => Promise<string>;
  revokeSnapshot: (url: string) => void;
};

const tauriBridge: EmbeddedWebviewBridge = {
  create: native.embeddedWebviewCreate,
  navigate: native.embeddedWebviewNavigate,
  setBounds: native.embeddedWebviewSetBounds,
  setVisible: native.embeddedWebviewSetVisible,
  destroy: native.embeddedWebviewDestroy,
  snapshot: native.embeddedWebviewSnapshotUrl,
  revokeSnapshot: (url) => URL.revokeObjectURL(url),
};

let bridge: EmbeddedWebviewBridge = tauriBridge;

export function setEmbeddedWebviewBridge(next: EmbeddedWebviewBridge): void {
  bridge = next;
}

export function getEmbeddedWebviewBridge(): EmbeddedWebviewBridge {
  return bridge;
}

// ─── Native page events ───

let eventsBound = false;

/** Subscribe to native page events. Lazy so tests never touch Tauri APIs. */
async function bindNativeEvents(): Promise<void> {
  if (eventsBound) return;
  eventsBound = true;
  const { listen } = await import("@tauri-apps/api/event");
  await listen<EmbeddedWebviewEvent>("embedded-webview-event", ({ payload }) => {
    const { patchFrame } = useEmbeddedWebviewStore.getState().actions;
    switch (payload.event.kind) {
      case "titleChanged":
        patchFrame(payload.label, { title: payload.event.title });
        break;
      case "urlChanged":
        patchFrame(payload.label, { url: payload.event.url });
        break;
      case "loadStarted":
        patchFrame(payload.label, { url: payload.event.url, status: "loading" });
        break;
      case "loadFinished":
        patchFrame(payload.label, { url: payload.event.url, status: "ready" });
        break;
    }
  });
}

// ─── Overlay-hide engine ───

/**
 * Sequence token guarding cover/uncover races: every 0↔1 transition takes a
 * new token, and async continuations (snapshot resolution, the one-frame
 * uncover delay) bail out when the token has moved on. Rapid open/close
 * cycles therefore never leave the webview hidden or a stale snapshot up.
 */
let coverToken = 0;

function nextFrame(callback: () => void): void {
  if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => callback());
  else setTimeout(callback, 0);
}

function coverFrame(label: string, token: number): Promise<void> {
  const store = useEmbeddedWebviewStore;
  const frame = store.getState().frames[label];
  if (!frame) return Promise.resolve();

  // Re-covered before the uncover finished: the existing snapshot is still
  // showing (and the page may already be hidden mid-capture), so keep it.
  if (frame.snapshotUrl || frame.coverFallback) {
    store.getState().actions.patchFrame(label, { covered: true });
    return bridge.setVisible(label, false).catch(() => undefined);
  }

  return bridge
    .snapshot(label)
    .then((snapshotUrl) => {
      if (token !== coverToken || !store.getState().frames[label]) {
        bridge.revokeSnapshot(snapshotUrl);
        return;
      }
      store.getState().actions.patchFrame(label, { covered: true, snapshotUrl, coverFallback: false });
      return bridge.setVisible(label, false);
    })
    .catch(() => {
      // Snapshot failed or unsupported (e.g. Linux WebKitGTK edge cases):
      // fall back to hiding behind the neutral placeholder surface.
      if (token !== coverToken || !store.getState().frames[label]) return;
      store.getState().actions.patchFrame(label, { covered: true, coverFallback: true });
      return bridge.setVisible(label, false).catch(() => undefined);
    });
}

function uncoverFrame(label: string, token: number): Promise<void> {
  const store = useEmbeddedWebviewStore;
  const frame = store.getState().frames[label];
  if (!frame?.covered) return Promise.resolve();

  return bridge
    .setVisible(label, true)
    .catch(() => undefined)
    .then(() => {
      // Keep the snapshot up for one more frame so the native view is
      // already compositing when it disappears — no flash of placeholder.
      nextFrame(() => {
        if (token !== coverToken) return;
        const current = store.getState().frames[label];
        if (!current) return;
        if (current.snapshotUrl) bridge.revokeSnapshot(current.snapshotUrl);
        store.getState().actions.patchFrame(label, {
          covered: false,
          snapshotUrl: null,
          coverFallback: false,
        });
      });
    });
}

/** An overlay that can occlude embedded webviews opened. */
export function notifyOverlayOpened(): void {
  const store = useEmbeddedWebviewStore;
  const count = store.getState().overlayCount + 1;
  store.getState().actions.setOverlayCount(count);
  if (count !== 1) return;
  const token = ++coverToken;
  for (const label of Object.keys(store.getState().frames)) {
    void coverFrame(label, token);
  }
}

/** An overlay closed; when the last one closes, webviews are restored. */
export function notifyOverlayClosed(): void {
  const store = useEmbeddedWebviewStore;
  const count = Math.max(0, store.getState().overlayCount - 1);
  store.getState().actions.setOverlayCount(count);
  if (count !== 0) return;
  const token = ++coverToken;
  for (const label of Object.keys(store.getState().frames)) {
    void uncoverFrame(label, token);
  }
}

// ─── Frame lifecycle (called by EmbeddedWebviewFrame) ───

export function mountFrame(label: string): void {
  void bindNativeEvents();
  useEmbeddedWebviewStore.getState().actions.frameMounted(label);
  // Mounting under an already-open overlay: cover immediately so the native
  // view never paints on top of it.
  if (useEmbeddedWebviewStore.getState().overlayCount > 0) {
    void coverFrame(label, coverToken);
  }
}

export function unmountFrame(label: string): void {
  useEmbeddedWebviewStore.getState().actions.frameUnmounted(label);
}
