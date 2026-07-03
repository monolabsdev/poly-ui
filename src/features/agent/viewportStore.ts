import { create } from "zustand";
import * as native from "./native";

/**
 * One viewport session at a time, scoped to the agent run that opened it.
 * The WebView itself is a native child webview embedded in the main window
 * (src-tauri/src/agent_viewport.rs); this store mirrors its state for the
 * drawer and the timeline card. Closing the drawer hides the webview but
 * keeps the session; only browser_close / run failure / chat deletion
 * destroy it.
 */
export type ViewportStatus = "loading" | "ready" | "closed";

export type ViewportSession = {
  runId: string;
  chatId: string | null;
  kind: "url" | "file";
  /** What the header shows: the URL, or the workspace file path. */
  label: string;
  url: string;
  reason: string | null;
  status: ViewportStatus;
  openedAt: number;
};

type ViewportStore = {
  session: ViewportSession | null;
  drawerOpen: boolean;
  drawerWidth: number;
  reloadSeq: number;
  actions: {
    opened: (session: Omit<ViewportSession, "status" | "openedAt">) => void;
    statusChanged: (phase: ViewportStatus, url: string) => void;
    setDrawerOpen: (open: boolean) => void;
    setDrawerWidth: (width: number) => void;
    reloaded: () => void;
    clear: () => void;
  };
};

const WIDTH_STORAGE_KEY = "poly_agent_viewport_width";
export const VIEWPORT_MIN_WIDTH = 320;
export const VIEWPORT_MAX_WIDTH = 900;

function loadWidth(): number {
  const raw = Number(localStorage.getItem(WIDTH_STORAGE_KEY));
  return Number.isFinite(raw) && raw >= VIEWPORT_MIN_WIDTH && raw <= VIEWPORT_MAX_WIDTH ? raw : 440;
}

export const useViewportStore = create<ViewportStore>((set) => ({
  session: null,
  drawerOpen: false,
  drawerWidth: loadWidth(),
  reloadSeq: 0,
  actions: {
    opened: (session) =>
      set({ session: { ...session, status: "loading", openedAt: Date.now() }, drawerOpen: true }),
    statusChanged: (phase, url) =>
      set((state) => {
        if (!state.session) return state;
        if (phase === "closed") return { session: null, drawerOpen: false };
        const navigatedAway = url !== "" && url !== state.session.url;
        return {
          session: {
            ...state.session,
            status: phase,
            url: url || state.session.url,
            // File previews keep the friendly path label unless the page
            // actually navigated somewhere else.
            label: state.session.kind === "file" && !navigatedAway ? state.session.label : url || state.session.label,
          },
        };
      }),
    setDrawerOpen: (drawerOpen) => set({ drawerOpen }),
    setDrawerWidth: (drawerWidth) => {
      localStorage.setItem(WIDTH_STORAGE_KEY, String(drawerWidth));
      set({ drawerWidth });
    },
    reloaded: () => set((state) => ({ reloadSeq: state.reloadSeq + 1 })),
    clear: () => set({ session: null, drawerOpen: false }),
  },
}));

let eventsBound = false;

/** Subscribe to native webview status events. Lazy so tests never touch Tauri APIs. */
async function bindNativeEvents() {
  if (eventsBound) return;
  eventsBound = true;
  const { listen } = await import("@tauri-apps/api/event");
  await listen<{ url: string; phase: ViewportStatus }>("agent-viewport-status", (event) => {
    useViewportStore.getState().actions.statusChanged(event.payload.phase, event.payload.url);
  });
}

export async function openViewportUrl(input: {
  runId: string;
  chatId: string | null;
  url: string;
  reason: string | null;
}): Promise<void> {
  await bindNativeEvents();
  const url = await native.agentViewportOpen(input.url);
  useViewportStore.getState().actions.opened({
    runId: input.runId,
    chatId: input.chatId,
    kind: "url",
    label: url,
    url,
    reason: input.reason,
  });
}

export async function openViewportFile(input: {
  runId: string;
  chatId: string | null;
  workspacePath: string;
  path: string;
  reason: string | null;
}): Promise<void> {
  await bindNativeEvents();
  const url = await native.agentViewportOpenFile(input.workspacePath, input.path);
  useViewportStore.getState().actions.opened({
    runId: input.runId,
    chatId: input.chatId,
    kind: "file",
    label: input.path,
    url,
    reason: input.reason,
  });
}

/** Destroy the webview and forget the session. */
export async function closeViewport(): Promise<void> {
  useViewportStore.getState().actions.clear();
  await native.agentViewportClose().catch(() => undefined);
}

/** Hide the drawer but keep the session and page state alive. */
export function hideViewportDrawer(): void {
  useViewportStore.getState().actions.setDrawerOpen(false);
  void native.agentViewportHide().catch(() => undefined);
}

export function showViewportDrawer(): void {
  if (useViewportStore.getState().session) {
    useViewportStore.getState().actions.setDrawerOpen(true);
  }
}

export function reloadViewport(): Promise<void> {
  useViewportStore.getState().actions.reloaded();
  return native.agentViewportReload();
}

/** Resolve when the page finishes loading, or on timeout. */
export function waitForViewportReady(timeoutMs: number): Promise<ViewportStatus> {
  const current = useViewportStore.getState().session?.status;
  if (!current || current !== "loading") return Promise.resolve(current ?? "closed");
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      unsubscribe();
      resolve(useViewportStore.getState().session?.status ?? "closed");
    }, timeoutMs);
    const unsubscribe = useViewportStore.subscribe((state) => {
      const status = state.session?.status ?? "closed";
      if (status !== "loading") {
        clearTimeout(timer);
        unsubscribe();
        resolve(status);
      }
    });
  });
}

/** Close the viewport if it belongs to a cancelled/failed run. */
export function closeViewportForRun(runId: string): void {
  if (useViewportStore.getState().session?.runId === runId) void closeViewport();
}

/** Close the viewport if it belongs to a deleted chat. */
export function closeViewportForChat(chatId: string): void {
  if (useViewportStore.getState().session?.chatId === chatId) void closeViewport();
}
