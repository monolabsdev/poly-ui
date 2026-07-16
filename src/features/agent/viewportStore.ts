import { create } from "zustand";
import {
  getEmbeddedWebviewBridge,
  useEmbeddedWebviewStore,
} from "@/features/embedded-webview/embeddedWebviewStore";
import * as native from "./native";
import type { AgentEditedFile, AgentToolCall } from "./types";

/**
 * One viewport session at a time, scoped to the agent run that opened it.
 * The page renders in a native embedded webview owned by the drawer
 * (EmbeddedWebviewFrame, label AGENT_BROWSER_LABEL); agent observations run
 * against that same visible webview, so the agent always sees exactly what
 * the user sees. This store mirrors its state for the drawer and the
 * timeline card. Closing the drawer hides the webview but keeps the session;
 * only browser_close / run failure / chat deletion destroy it.
 */

/** Label of the drawer's browser webview in the embedded webview manager. */
export const AGENT_BROWSER_LABEL = "agent-browser";
export type ViewportStatus = "loading" | "ready" | "closed";

export type ViewportSession = {
  runId: string;
  chatId: string | null;
  kind: "url" | "file";
  /** Who asked for the page: the agent run, the chat model, or a user click. */
  openedBy: "agent" | "chat" | "user";
  /** What the header shows: the URL, or the workspace file path. */
  label: string;
  url: string;
  reason: string | null;
  status: ViewportStatus;
  openedAt: number;
};

export type ViewportTab = "review" | "browser";

export type ViewportReview = {
  workspacePath?: string;
  initialPath?: string;
  fallbackFiles: AgentEditedFile[];
  toolCalls: Record<string, AgentToolCall>;
};

type ViewportStore = {
  session: ViewportSession | null;
  review: ViewportReview | null;
  browserOpen: boolean;
  activeTab: ViewportTab;
  tabOrder: ViewportTab[];
  drawerOpen: boolean;
  drawerWidth: number;
  lastActiveTab: ViewportTab;
  actions: {
    opened: (session: Omit<ViewportSession, "status" | "openedAt">) => void;
    browserOpened: () => void;
    browserClosed: () => void;
    reviewOpened: (review: ViewportReview) => void;
    reviewClosed: () => void;
    statusChanged: (phase: ViewportStatus, url: string) => void;
    setActiveTab: (tab: ViewportTab) => void;
    moveTab: (tab: ViewportTab, target: ViewportTab, side: "before" | "after") => void;
    setDrawerOpen: (open: boolean) => void;
    setDrawerWidth: (width: number) => void;
    clear: () => void;
  };
};

const WIDTH_STORAGE_KEY = "poly_agent_viewport_width";
const LAST_TAB_KEY = "poly_agent_viewport_last_tab";
export const VIEWPORT_MIN_WIDTH = 320;
export const VIEWPORT_MAX_WIDTH = 900;

function appendTab(order: ViewportTab[], tab: ViewportTab): ViewportTab[] {
  return order.includes(tab) ? order : [...order, tab];
}

function removeTab(order: ViewportTab[], tab: ViewportTab): ViewportTab[] {
  return order.filter((item) => item !== tab);
}

function moveTab(order: ViewportTab[], tab: ViewportTab, target: ViewportTab, side: "before" | "after"): ViewportTab[] {
  if (tab === target || !order.includes(tab) || !order.includes(target)) return order;
  const withoutTab = removeTab(order, tab);
  const targetIndex = withoutTab.indexOf(target);
  const insertAt = side === "before" ? targetIndex : targetIndex + 1;
  return [...withoutTab.slice(0, insertAt), tab, ...withoutTab.slice(insertAt)];
}

function loadWidth(): number {
  // Node test imports have no localStorage; fall back to the default width.
  const raw = typeof localStorage === "undefined" ? NaN : Number(localStorage.getItem(WIDTH_STORAGE_KEY));
  return Number.isFinite(raw) && raw >= VIEWPORT_MIN_WIDTH && raw <= VIEWPORT_MAX_WIDTH ? raw : 440;
}

function loadLastTab(): ViewportTab {
  const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(LAST_TAB_KEY);
  if (raw === "browser" || raw === "review") return raw;
  return "browser";
}

export const useViewportStore = create<ViewportStore>((set) => ({
  session: null,
  review: null,
  browserOpen: false,
  activeTab: "browser",
  tabOrder: [],
  drawerOpen: false,
  drawerWidth: loadWidth(),
  lastActiveTab: loadLastTab(),
  actions: {
    opened: (session) =>
      set((state) => ({
        session: { ...session, status: "loading", openedAt: Date.now() },
        browserOpen: true,
        activeTab: "browser",
        tabOrder: appendTab(state.tabOrder, "browser"),
        drawerOpen: true,
      })),
    browserOpened: () =>
      set((state) => ({
        browserOpen: true,
        activeTab: "browser",
        tabOrder: appendTab(state.tabOrder, "browser"),
        drawerOpen: true,
      })),
    browserClosed: () =>
      set((state) => ({
        session: null,
        browserOpen: false,
        activeTab: state.review ? "review" : "browser",
        tabOrder: removeTab(state.tabOrder, "browser"),
        drawerOpen: Boolean(state.review),
      })),
    reviewOpened: (review) =>
      set((state) => ({
        review,
        activeTab: "review",
        tabOrder: appendTab(state.tabOrder, "review"),
        drawerOpen: true,
      })),
    reviewClosed: () =>
      set((state) => ({
        review: null,
        activeTab: "browser",
        tabOrder: removeTab(state.tabOrder, "review"),
        drawerOpen: state.browserOpen,
      })),
    statusChanged: (phase, url) =>
      set((state) => {
        if (!state.session) return state;
        if (phase === "closed") {
          return {
            session: null,
            browserOpen: false,
            activeTab: state.review ? "review" : "browser",
            tabOrder: removeTab(state.tabOrder, "browser"),
            drawerOpen: Boolean(state.review),
          };
        }
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
    setActiveTab: (activeTab) => set({ activeTab, drawerOpen: true }),
    moveTab: (tab, target, side) => set((state) => ({ tabOrder: moveTab(state.tabOrder, tab, target, side) })),
    setDrawerOpen: (drawerOpen) =>
      set((state) => {
        if (!drawerOpen) {
          localStorage.setItem(LAST_TAB_KEY, state.activeTab);
          return { drawerOpen, lastActiveTab: state.activeTab };
        }
        return { drawerOpen };
      }),
    setDrawerWidth: (drawerWidth) => {
      localStorage.setItem(WIDTH_STORAGE_KEY, String(drawerWidth));
      set({ drawerWidth });
    },
    clear: () => set({ session: null, review: null, browserOpen: false, tabOrder: [], drawerOpen: false }),
  },
}));

let statusBound = false;

/**
 * Mirror the browser frame's load status and URL into the session. The
 * embedded webview store is fed by native page events; subscribing to it
 * (rather than Tauri events directly) keeps this testable without Tauri.
 */
function bindEmbeddedStatus(): void {
  if (statusBound) return;
  statusBound = true;
  let last = useEmbeddedWebviewStore.getState().frames[AGENT_BROWSER_LABEL];
  useEmbeddedWebviewStore.subscribe((state) => {
    const frame = state.frames[AGENT_BROWSER_LABEL];
    const previous = last;
    last = frame;
    if (!frame || frame === previous) return;
    if (frame.status !== previous?.status || frame.url !== previous?.url) {
      useViewportStore
        .getState()
        .actions.statusChanged(frame.status === "ready" ? "ready" : "loading", frame.url ?? "");
    }
  });
}

export async function openViewportUrl(input: {
  runId: string;
  chatId: string | null;
  url: string;
  reason: string | null;
  openedBy?: ViewportSession["openedBy"];
}): Promise<void> {
  const url = safeHttpUrl(input.url);
  if (!url) {
    throw new Error("Blocked URL: only http and https pages can open in the viewport.");
  }
  bindEmbeddedStatus();
  useViewportStore.getState().actions.opened({
    runId: input.runId,
    chatId: input.chatId,
    kind: "url",
    openedBy: input.openedBy ?? "agent",
    label: url,
    url,
    reason: input.reason,
  });
}

/** Open a page the user clicked (e.g. a web-search source) in the viewport. */
export function openViewportForUser(url: string): Promise<void> {
  openViewportPreviewUrl({ runId: "user", chatId: null, url, reason: null, openedBy: "user" });
  return Promise.resolve();
}

/**
 * Capture-phase click handler that reroutes anchor clicks into the viewport
 * instead of the external browser. Spread onto a container via
 * `onClickCapture` so nested link components need no changes.
 */
export function viewportLinkClickCapture(event: {
  target: EventTarget | null;
  preventDefault: () => void;
}): void {
  const anchor =
    event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href^='http']") : null;
  if (!anchor) return;
  event.preventDefault();
  void openViewportForUser(anchor.href).catch((error) =>
    console.warn("Failed to open link in viewport:", error),
  );
}

/**
 * Listen for `show_webpage` tool calls from the normal chat model (emitted by
 * the Rust tool loop as `viewport-open-request`). Called once by the store
 * coordinator; `getChatId` keeps this store decoupled from chatStore.
 */
export async function bindViewportOpenRequests(
  getChatId: () => string | null,
): Promise<() => void> {
  const { listen } = await import("@tauri-apps/api/event");
  return listen<{ url: string }>("viewport-open-request", (event) => {
    openViewportPreviewUrl({
      runId: "chat",
      chatId: getChatId(),
      url: event.payload.url,
      reason: null,
      openedBy: "chat",
    });
  });
}

export async function openViewportFile(input: {
  runId: string;
  chatId: string | null;
  workspacePath: string;
  path: string;
  reason: string | null;
}): Promise<void> {
  const url = await native.agentViewportServeFile(input.workspacePath, input.path);
  bindEmbeddedStatus();
  useViewportStore.getState().actions.opened({
    runId: input.runId,
    chatId: input.chatId,
    kind: "file",
    openedBy: "agent",
    label: input.path,
    url,
    reason: input.reason,
  });
}

/**
 * Forget the session; the drawer unmounts the frame, destroying the native
 * webview. The workspace file server stops handing out files.
 */
export async function closeViewport(): Promise<void> {
  useViewportStore.getState().actions.clear();
  await native.agentViewportStopServing().catch(() => undefined);
}

/** Open the drawer to a blank browser tab for manual navigation. */
export function openEmptyViewport(): void {
  useViewportStore.getState().actions.browserOpened();
}

/** Close only the browser tab; keep an open review tab alive. */
export function closeViewportBrowser(): void {
  const hadSession = Boolean(useViewportStore.getState().session);
  useViewportStore.getState().actions.browserClosed();
  if (hadSession) void native.agentViewportStopServing().catch(() => undefined);
}

/** Close only the review tab; keep an open browser tab alive. */
export function closeViewportReview(): void {
  useViewportStore.getState().actions.reviewClosed();
}

/** Hide the drawer but keep the session and page state alive. */
export function hideViewportDrawer(): void {
  // The frame's `visible` prop hides the native view when the drawer closes.
  useViewportStore.getState().actions.setDrawerOpen(false);
}

export function showViewportDrawer(): void {
  const state = useViewportStore.getState();
  if (state.browserOpen || state.session || state.review) {
    useViewportStore.getState().actions.setDrawerOpen(true);
    if (state.activeTab !== state.lastActiveTab) {
      useViewportStore.getState().actions.setActiveTab(state.lastActiveTab);
    }
  }
}

export function openViewportReview(review: ViewportReview): void {
  useViewportStore.getState().actions.reviewOpened(review);
}

export function openViewportPreviewUrl(input: {
  runId: string;
  chatId: string | null;
  url: string;
  reason: string | null;
  openedBy: ViewportSession["openedBy"];
}): void {
  const url = safeHttpUrl(input.url);
  if (!url) return;
  const actions = useViewportStore.getState().actions;
  actions.opened({
    runId: input.runId,
    chatId: input.chatId,
    kind: "url",
    openedBy: input.openedBy,
    label: url,
    url,
    reason: input.reason,
  });
  actions.statusChanged("ready", url);
}

export function reloadViewport(): Promise<void> {
  return getEmbeddedWebviewBridge().reload(AGENT_BROWSER_LABEL);
}

function safeHttpUrl(input: string): string | null {
  try {
    const url = new URL(input);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
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
