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
  /**
   * Whether the frame wants its native view on screen. CSS can't hide a
   * native view, so hosts (e.g. the viewport drawer when collapsed) drive
   * this explicitly; the overlay engine restores to it on uncover.
   */
  shown: boolean;
  /** True while an overlay hides the native webview. */
  covered: boolean;
  /** Object URL of the snapshot shown while covered. */
  snapshotUrl: string | null;
  /**
   * Warm snapshot kept between covers (refreshed on page load and after each
   * uncover) so opening an overlay swaps to it instantly instead of waiting
   * ~100ms for a fresh capture — the main source of visible flicker.
   */
  cachedSnapshotUrl: string | null;
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
            shown: true,
            covered: false,
            snapshotUrl: null,
            cachedSnapshotUrl: null,
            coverFallback: false,
          },
        },
      })),
    frameUnmounted: (label) =>
      set((state) => {
        const { [label]: removed, ...frames } = state.frames;
        for (const url of new Set([removed?.snapshotUrl, removed?.cachedSnapshotUrl])) {
          if (url) bridge.revokeSnapshot(url);
        }
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
  reload: (label: string) => Promise<void>;
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
  reload: native.embeddedWebviewReload,
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

/**
 * Subscribe to native page events. Lazy, and a no-op outside Tauri (Node
 * tests drive the store through the injected bridge instead).
 */
async function bindNativeEvents(): Promise<void> {
  if (eventsBound) return;
  eventsBound = true;
  try {
    const { listen } = await import("@tauri-apps/api/event");
    await listen<EmbeddedWebviewEvent>("embedded-webview-event", ({ payload }) =>
      applyEmbeddedWebviewEvent(payload),
    );
  } catch {
    // Not running under Tauri (Node tests): the bridge seam drives state.
  }
}

/** Map a native page event onto frame state (exported for tests). */
export function applyEmbeddedWebviewEvent(payload: EmbeddedWebviewEvent): void {
  const { patchFrame } = useEmbeddedWebviewStore.getState().actions;
  switch (payload.event.kind) {
    case "titleChanged":
      patchFrame(payload.label, { title: payload.event.title });
      break;
    case "urlChanged":
      // The page is changing: the warm snapshot no longer matches it.
      patchFrame(payload.label, { url: payload.event.url });
      patchFrameSnapshots(payload.label, { cachedSnapshotUrl: null });
      break;
    case "loadStarted":
      patchFrame(payload.label, { url: payload.event.url, status: "loading" });
      patchFrameSnapshots(payload.label, { cachedSnapshotUrl: null });
      disarmSnapshotRefresh(payload.label);
      startLoadWatchdog(payload.label);
      break;
    case "loadFinished":
      patchFrame(payload.label, { url: payload.event.url, status: "ready" });
      clearLoadWatchdog(payload.label);
      // Warm the cache so the very first overlay already swaps instantly,
      // then keep it fresh on the idle cadence.
      void refreshSnapshotCache(payload.label).then(() => armSnapshotRefresh(payload.label));
      break;
  }
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

/** Resolve after the next commit + paint (two frames). */
function afterPaint(): Promise<void> {
  return new Promise((resolve) => nextFrame(() => nextFrame(resolve)));
}

/**
 * Force-decode a snapshot before it is shown, so swapping it in (or hiding
 * the native view behind it) never paints an empty frame.
 */
function loadSnapshot(url: string): Promise<void> {
  if (typeof Image === "undefined") return Promise.resolve();
  const image = new Image();
  image.src = url;
  return image.decode().catch(() => undefined);
}

/**
 * Patch a frame and revoke any snapshot object URL the patch orphaned. All
 * snapshotUrl/cachedSnapshotUrl changes go through here so blobs can't leak
 * or be revoked while still displayed (the two fields often share a URL).
 */
function patchFrameSnapshots(label: string, patch: Partial<EmbeddedFrameState>): void {
  const store = useEmbeddedWebviewStore;
  const before = store.getState().frames[label];
  store.getState().actions.patchFrame(label, patch);
  const after = store.getState().frames[label];
  const kept = new Set([after?.snapshotUrl, after?.cachedSnapshotUrl]);
  for (const url of new Set([before?.snapshotUrl, before?.cachedSnapshotUrl])) {
    if (url && !kept.has(url)) bridge.revokeSnapshot(url);
  }
}

/** Labels with a warm-cache capture in flight, so refreshes can't pile up. */
const capturing = new Set<string>();

/**
 * Capture the visible page into the warm cache. Called when a page finishes
 * loading, after each uncover, and on an idle cadence while visible, so the
 * next cover swaps in a snapshot that matches the live page — the closer the
 * cache tracks reality, the less visible the cover swap.
 */
function refreshSnapshotCache(label: string): Promise<void> {
  const store = useEmbeddedWebviewStore;
  const frame = store.getState().frames[label];
  if (!frame || !frame.shown || frame.covered || capturing.has(label)) {
    return Promise.resolve();
  }
  capturing.add(label);
  return bridge
    .snapshot(label)
    .then(async (fresh) => {
      await loadSnapshot(fresh);
      const current = store.getState().frames[label];
      // A cover raced this capture: the page may have been hidden mid-frame,
      // so the result can't be trusted as a cache.
      if (!current || current.covered) {
        bridge.revokeSnapshot(fresh);
        return;
      }
      patchFrameSnapshots(label, { cachedSnapshotUrl: fresh });
    })
    .catch(() => undefined)
    .finally(() => capturing.delete(label));
}

/**
 * Idle warm-cache refresh. A hidden native webview can't be captured, so the
 * only defence against a stale cover snapshot (the page scrolled or animated
 * since the last capture) is to keep re-capturing while the page is visible
 * and idle. Self-stops when the frame is covered, hidden, unmounted, or an
 * overlay is open; re-arms while eligible.
 *
 * ponytail: fixed interval, not change-driven — the page runs in a separate
 * native process with no push channel to the UI thread (none at all on Linux
 * raw wry), so we can't observe its scroll/mutation. Interval is the tuning
 * knob if capture cost ever matters.
 */
const SNAPSHOT_REFRESH_INTERVAL_MS = 2000;
const refreshTimers = new Map<string, ReturnType<typeof setTimeout>>();

function refreshEligible(label: string): boolean {
  const state = useEmbeddedWebviewStore.getState();
  const frame = state.frames[label];
  return Boolean(frame && frame.shown && !frame.covered && state.overlayCount === 0);
}

function armSnapshotRefresh(label: string): void {
  disarmSnapshotRefresh(label);
  if (typeof setTimeout === "undefined" || !refreshEligible(label)) return;
  const timer = setTimeout(() => {
    refreshTimers.delete(label);
    if (!refreshEligible(label)) return;
    // Window unfocused: skip the capture but keep checking back.
    if (typeof document !== "undefined" && document.hidden) {
      armSnapshotRefresh(label);
      return;
    }
    void refreshSnapshotCache(label).finally(() => {
      if (refreshEligible(label)) armSnapshotRefresh(label);
    });
  }, SNAPSHOT_REFRESH_INTERVAL_MS);
  refreshTimers.set(label, timer);
}

function disarmSnapshotRefresh(label: string): void {
  const timer = refreshTimers.get(label);
  if (timer !== undefined) {
    clearTimeout(timer);
    refreshTimers.delete(label);
  }
}

/**
 * Stop the loading spinner if a navigation never reports finished (dropped
 * connection, TLS failure): the host only emits load start/finish, so a
 * frontend deadline is the portable way to settle the status.
 */
const LOAD_WATCHDOG_MS = 20_000;
const watchdogTimers = new Map<string, ReturnType<typeof setTimeout>>();

function startLoadWatchdog(label: string): void {
  clearLoadWatchdog(label);
  if (typeof setTimeout === "undefined") return;
  const timer = setTimeout(() => {
    watchdogTimers.delete(label);
    const frame = useEmbeddedWebviewStore.getState().frames[label];
    if (frame?.status === "loading") {
      useEmbeddedWebviewStore.getState().actions.patchFrame(label, { status: "ready" });
    }
  }, LOAD_WATCHDOG_MS);
  watchdogTimers.set(label, timer);
}

function clearLoadWatchdog(label: string): void {
  const timer = watchdogTimers.get(label);
  if (timer !== undefined) {
    clearTimeout(timer);
    watchdogTimers.delete(label);
  }
}

/** Clear all module-level timers and in-flight state (test seam). */
export function resetEmbeddedWebviewInternals(): void {
  for (const timer of refreshTimers.values()) clearTimeout(timer);
  refreshTimers.clear();
  for (const timer of watchdogTimers.values()) clearTimeout(timer);
  watchdogTimers.clear();
  capturing.clear();
  coverToken += 1;
}

function coverFrame(label: string, token: number): Promise<void> {
  const store = useEmbeddedWebviewStore;
  const frame = store.getState().frames[label];
  if (!frame) return Promise.resolve();

  // The page is about to be hidden; stop the idle refresh loop.
  disarmSnapshotRefresh(label);

  // A frame the host is hiding anyway needs no snapshot — it can't occlude.
  if (!frame.shown) return Promise.resolve();

  // Re-covered before the uncover finished: the existing snapshot is still
  // showing (and the page may already be hidden mid-capture), so keep it.
  if (frame.snapshotUrl || frame.coverFallback) {
    store.getState().actions.patchFrame(label, { covered: true });
    return bridge.setVisible(label, false).catch(() => undefined);
  }

  // Warm cache: swap it in and hide within a couple of frames, instead of
  // leaving the overlay clipped under the live page while a fresh capture
  // (~100ms of snapshot + encode + transfer) completes.
  const cached = frame.cachedSnapshotUrl;
  if (cached) {
    return loadSnapshot(cached).then(async () => {
      if (token !== coverToken || !store.getState().frames[label]) return;
      patchFrameSnapshots(label, { covered: true, snapshotUrl: cached, coverFallback: false });
      await afterPaint();
      if (token !== coverToken) return;
      await bridge.setVisible(label, false).catch(() => undefined);
    });
  }

  return bridge
    .snapshot(label)
    .then(async (snapshotUrl) => {
      if (!store.getState().frames[label]) {
        bridge.revokeSnapshot(snapshotUrl);
        return;
      }
      // Decode before showing/hiding anything so the swap never paints an
      // empty frame; late captures still warm the cache for the next cover.
      await loadSnapshot(snapshotUrl);
      if (token !== coverToken) {
        patchFrameSnapshots(label, { cachedSnapshotUrl: snapshotUrl });
        return;
      }
      patchFrameSnapshots(label, {
        covered: true,
        snapshotUrl,
        cachedSnapshotUrl: snapshotUrl,
        coverFallback: false,
      });
      await afterPaint();
      if (token !== coverToken) return;
      await bridge.setVisible(label, false);
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
    .setVisible(label, store.getState().frames[label]?.shown ?? true)
    .catch(() => undefined)
    .then(async () => {
      // Keep the snapshot up through a full paint cycle so the native view
      // is already compositing when it disappears — no flash of placeholder.
      await afterPaint();
      if (token !== coverToken) return;
      const current = store.getState().frames[label];
      if (!current) return;
      // The displayed snapshot stays alive as the warm cache for the next
      // cover (patchFrameSnapshots only revokes orphaned URLs).
      patchFrameSnapshots(label, {
        covered: false,
        snapshotUrl: null,
        coverFallback: false,
        cachedSnapshotUrl: current.snapshotUrl ?? current.cachedSnapshotUrl,
      });
      // The page is visible again: refresh the cache so the next cover shows
      // current content rather than this cycle's frame, then resume the idle
      // refresh loop.
      await refreshSnapshotCache(label);
      armSnapshotRefresh(label);
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
  disarmSnapshotRefresh(label);
  clearLoadWatchdog(label);
  capturing.delete(label);
  useEmbeddedWebviewStore.getState().actions.frameUnmounted(label);
}

/**
 * Set whether a frame wants its native view on screen (drawer collapsed,
 * inactive tab, ...). Applied immediately unless an overlay currently covers
 * the frame — then the uncover pass restores to this value instead.
 */
export function setFrameShown(
  label: string,
  shown: boolean,
  options?: {
    /**
     * Apply even when state already matches — used right after (re)creating
     * or re-adopting a native view, whose actual visibility is unknown.
     */
    force?: boolean;
  },
): Promise<void> {
  const store = useEmbeddedWebviewStore;
  const frame = store.getState().frames[label];
  if (!frame || (!options?.force && frame.shown === shown)) return Promise.resolve();
  store.getState().actions.patchFrame(label, { shown });
  if (!shown) disarmSnapshotRefresh(label);
  if (frame.covered) return Promise.resolve();
  if (shown && store.getState().overlayCount > 0) {
    // Shown under an open overlay: cover instead of revealing on top of it.
    return coverFrame(label, coverToken);
  }
  return bridge.setVisible(label, shown).catch(() => undefined).then(() => {
    // Freshly revealed with no overlay: keep the cache warm.
    if (shown) armSnapshotRefresh(label);
  });
}
