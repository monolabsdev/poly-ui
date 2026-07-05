import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  FileText,
  Globe2,
  Loader2,
  MoreVertical,
  PanelRightClose,
  Plus,
  RotateCw,
  X,
} from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { IconButton } from "@/components/ui/icon-button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import * as native from "./native";
import { AgentReviewContent } from "./AgentReviewPanel";
import { resolveBrowserInput } from "./browserNavigation";
import {
  closeViewportBrowser,
  closeViewportReview,
  hideViewportDrawer,
  openEmptyViewport,
  openViewportReview,
  openViewportUrl,
  reloadViewport,
  useViewportStore,
  VIEWPORT_MAX_WIDTH,
  VIEWPORT_MIN_WIDTH,
} from "./viewportStore";

const BADGE_TEXT = { agent: "Opened by Agent", chat: "Opened by AI", user: null } as const;
export function AgentViewportDrawer() {
  const session = useViewportStore((state) => state.session);
  const review = useViewportStore((state) => state.review);
  const browserOpen = useViewportStore((state) => state.browserOpen);
  const activeTab = useViewportStore((state) => state.activeTab);
  const open = useViewportStore((state) => state.drawerOpen);
  const width = useViewportStore((state) => state.drawerWidth);
  const setActiveTab = useViewportStore((state) => state.actions.setActiveTab);
  const setDrawerWidth = useViewportStore((state) => state.actions.setDrawerWidth);
  const asideRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (session?.url) setUrl(session.url);
  }, [session?.url]);

  // The page itself is a native child webview (src-tauri/src/agent_viewport.rs)
  // layered over the window; keep its bounds glued to the content box. CSS px
  // equal Tauri logical px because the main webview fills the window.
  useEffect(() => {
    const el = contentRef.current;
    if (!session || !open || activeTab !== "browser" || !el) {
      void native.agentViewportHide().catch(() => undefined);
      return;
    }
    let frame = 0;
    let last = "";
    const sync = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const rect = el.getBoundingClientRect();
        const bounds = {
          x: Math.round(rect.x),
          y: Math.round(rect.y),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        };
        const key = `${bounds.x}:${bounds.y}:${bounds.width}:${bounds.height}`;
        if (key === last || bounds.width <= 0 || bounds.height <= 0) return;
        last = key;
        void native.agentViewportSetBounds(bounds).catch(() => undefined);
      });
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(el);
    // Sidebar collapse and window resizes move the drawer without resizing
    // the content box; the slide-in transition only moves it via transform.
    const main = el.closest("main");
    if (main) observer.observe(main);
    window.addEventListener("resize", sync);
    const aside = asideRef.current;
    aside?.addEventListener("transitionend", sync);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", sync);
      aside?.removeEventListener("transitionend", sync);
    };
  }, [activeTab, open, session]);

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    setDragging(true);

    const onMove = (move: globalThis.PointerEvent) => {
      const next = Math.min(
        VIEWPORT_MAX_WIDTH,
        Math.max(VIEWPORT_MIN_WIDTH, startWidth + startX - move.clientX),
      );
      setDrawerWidth(next);
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  const loading = session?.status === "loading";
  const badge = session ? BADGE_TEXT[session.openedBy] : null;
  const showBrowserTab = browserOpen || Boolean(session);
  const showReviewTab = Boolean(review);
  const visible = Boolean(open && (showBrowserTab || showReviewTab));
  const browserActive = activeTab === "browser";
  const reviewActive = activeTab === "review";

  const openTypedUrl = () => {
    const href = resolveBrowserInput(url);
    if (!href) return;
    void openViewportUrl({
      runId: "user",
      chatId: null,
      url: href,
      reason: null,
      openedBy: "user",
    });
  };

  const openExternal = () => {
    const href = session?.url || resolveBrowserInput(url);
    if (!href) return;
    void openUrl(href).catch(() => window.open(href, "_blank", "noopener,noreferrer"));
  };

  return (
    <aside
      ref={asideRef}
      aria-label="Agent viewport"
      className={cn(
        "relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden border-border bg-[#111111] text-foreground",
        !dragging && "transition-[width] duration-200 ease-out",
        visible && "border-l border-border",
      )}
      style={{ width: visible ? width : 0 }}
    >
      <div
        className="absolute inset-y-0 left-0 w-1 cursor-ew-resize touch-none bg-transparent hover:bg-border"
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize agent viewport"
        onPointerDown={startResize}
      />
      <header className="flex h-14 shrink-0 items-end gap-2 border-b border-white/10 bg-[#141414] px-3 pb-2">
        <nav className="flex min-w-0 flex-1 items-end gap-1.5">
          {showReviewTab ? (
            <DrawerTab
              active={reviewActive}
              icon={<FileText />}
              label="Summary"
              onClick={() => setActiveTab("review")}
              onClose={closeViewportReview}
            />
          ) : null}
          {showBrowserTab ? (
            <DrawerTab
              active={browserActive}
              icon={<Globe2 />}
              label={browserTabLabel(session?.label || session?.url)}
              onClick={() => setActiveTab("browser")}
              onClose={closeViewportBrowser}
            />
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton size="small" aria-label="Add viewport tab" title="Add tab">
                <Plus size={15} />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="min-w-44">
              <DropdownMenuItem onSelect={openEmptyViewport}>
                <Globe2 />
                Browser
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => openViewportReview(review ?? { fallbackFiles: [], toolCalls: {} })}>
                <FileText />
                Review / summary
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
        {loading ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" /> : null}
        <IconButton
          size="small"
          aria-label="Hide viewport"
          title="Hide viewport"
          onClick={hideViewportDrawer}
        >
          <PanelRightClose size={15} />
        </IconButton>
      </header>
      {browserActive ? (
        <section className="flex min-h-0 flex-1 flex-col bg-[#101010]">
          <div className="grid h-14 shrink-0 grid-cols-[auto_minmax(180px,1fr)_auto] items-center gap-4 border-b border-white/10 px-4">
            <div className="flex items-center gap-3">
              <IconButton
                size="small"
                aria-label="Back"
                title="Back"
                disabled
                className="text-[#767676]"
              >
                <ArrowLeft size={19} />
              </IconButton>
              <IconButton
                size="small"
                aria-label="Forward"
                title="Forward"
                disabled
                className="text-[#767676]"
              >
                <ArrowRight size={19} />
              </IconButton>
              <IconButton
                size="small"
                aria-label="Reload viewport"
                title="Reload viewport"
                onClick={() => void reloadViewport().catch(() => undefined)}
                disabled={!session}
                className="text-[#949494]"
              >
                <RotateCw size={16} />
              </IconButton>
            </div>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                openTypedUrl();
              }}
              className="relative mx-auto h-10 w-full max-w-[min(760px,78%)]"
            >
              <Input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="Enter a URL"
                className="h-10 rounded-[18px] border border-transparent bg-transparent px-5 pr-11 text-center text-[15px] text-foreground shadow-none transition-colors placeholder:text-[#8a8a8a] hover:bg-[#262626] focus:bg-transparent focus:text-left focus-visible:border-white/20 focus-visible:ring-0"
              />
              <button
                type="submit"
                aria-label="Open page or search"
                className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-[#8a8a8a] hover:bg-white/10 hover:text-foreground"
              >
                <ExternalLink size={16} />
              </button>
            </form>
            <div className="flex items-center justify-end gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <IconButton size="small" aria-label="More browser actions" title="More">
                    <MoreVertical size={18} />
                  </IconButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-52">
                  <DropdownMenuItem
                    disabled={!session?.url && !url.trim()}
                    onSelect={openExternal}
                  >
                    <ExternalLink />
                    Open in external browser
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {badge ? (
                <span className="rounded-xl bg-primary/15 px-2 py-1 text-xs font-medium text-primary">
                  {badge}
                </span>
              ) : null}
            </div>
          </div>
          <div ref={contentRef} className="min-h-0 flex-1 bg-[#101010] [contain:layout_paint_size]">
            {!session && !loading ? (
              <BrowserNewTabEmpty />
            ) : loading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Loading page...
              </div>
            ) : null}
          </div>
        </section>
      ) : (
        <section className="min-h-0 flex-1 bg-background">
          {review ? (
            <AgentReviewContent
              active={reviewActive}
              workspacePath={review.workspacePath}
              initialPath={review.initialPath}
              fallbackFiles={review.fallbackFiles}
              toolCalls={review.toolCalls}
              onClose={hideViewportDrawer}
            />
          ) : (
            <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
              No review summary for this run yet.
            </div>
          )}
        </section>
      )}
    </aside>
  );
}

function BrowserNewTabEmpty() {
  return (
    <div className="flex h-full items-center justify-center px-6 text-center">
      <div className="-mt-10 flex flex-col items-center">
        <Globe2 className="mb-8 size-20 text-[#969696]" strokeWidth={1.7} />
        <div className="text-lg font-medium text-foreground">Start browsing</div>
        <div className="mt-3 text-base text-muted-foreground">Enter a URL or search with Google</div>
      </div>
    </div>
  );
}

function DrawerTab({
  active,
  icon,
  label,
  onClose,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClose?: () => void;
  onClick: () => void;
}) {
  return (
    <div
      className={cn(
        "group inline-flex h-9 min-w-0 items-center rounded-2xl text-sm font-medium transition",
        active
          ? "bg-[#242424] text-foreground shadow-sm"
          : "text-muted-foreground hover:bg-white/[0.06] hover:text-foreground",
        "[&_svg]:size-4",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className="inline-flex h-full min-w-0 items-center gap-2 rounded-l-2xl pl-3 pr-1"
      >
        {icon}
        <span className="truncate">{label}</span>
      </button>
      {onClose ? (
        <button
          type="button"
          aria-label={`Close ${label} tab`}
          onClick={(event) => {
            event.stopPropagation();
            onClose();
          }}
          className="mr-1 inline-flex size-5 items-center justify-center rounded-full text-muted-foreground opacity-70 hover:bg-white/10 hover:text-foreground group-hover:opacity-100"
        >
          <X size={12} />
        </button>
      ) : null}
    </div>
  );
}

function browserTabLabel(value?: string | null) {
  if (!value) return "New tab";
  try {
    return new URL(value).hostname.replace(/^www\./, "") || "New tab";
  } catch {
    return value.length > 22 ? `${value.slice(0, 22)}...` : value;
  }
}
