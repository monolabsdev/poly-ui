import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Loader2, RotateCw, X } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { cn } from "@/lib/utils";
import * as native from "./native";
import {
  hideViewportDrawer,
  reloadViewport,
  useViewportStore,
  VIEWPORT_MAX_WIDTH,
  VIEWPORT_MIN_WIDTH,
} from "./viewportStore";

const BADGE_TEXT = { agent: "Opened by Agent", chat: "Opened by AI", user: null } as const;

export function AgentViewportDrawer() {
  const session = useViewportStore((state) => state.session);
  const open = useViewportStore((state) => state.drawerOpen);
  const width = useViewportStore((state) => state.drawerWidth);
  const setDrawerWidth = useViewportStore((state) => state.actions.setDrawerWidth);
  const asideRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  // The page itself is a native child webview (src-tauri/src/agent_viewport.rs)
  // layered over the window; keep its bounds glued to the content box. CSS px
  // equal Tauri logical px because the main webview fills the window.
  useEffect(() => {
    const el = contentRef.current;
    if (!session || !open || !el) {
      void native.agentViewportHide().catch(() => undefined);
      return;
    }
    const sync = () => {
      const rect = el.getBoundingClientRect();
      void native
        .agentViewportSetBounds({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })
        .catch(() => undefined);
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
      observer.disconnect();
      window.removeEventListener("resize", sync);
      aside?.removeEventListener("transitionend", sync);
    };
  }, [open, session]);

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    setDragging(true);

    const onMove = (move: globalThis.PointerEvent) => {
      const next = Math.min(VIEWPORT_MAX_WIDTH, Math.max(VIEWPORT_MIN_WIDTH, startWidth + startX - move.clientX));
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
  const visible = Boolean(open && session);

  // Sticky panel: takes layout space and pushes the chat over instead of
  // overlaying it; opening/closing animates the width down to zero.
  return (
    <aside
      ref={asideRef}
      aria-label="Agent viewport"
      className={cn(
        "relative flex h-full min-h-0 shrink-0 flex-col overflow-hidden bg-background",
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
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">
            {session?.label || session?.url || "Agent viewport"}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {loading ? "Loading" : session?.reason || session?.url}
          </div>
        </div>
        {badge ? (
          <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {badge}
          </span>
        ) : null}
        {loading ? <Loader2 className="size-4 shrink-0 animate-spin text-muted-foreground" /> : null}
        <IconButton
          size="small"
          aria-label="Reload viewport"
          title="Reload viewport"
          onClick={() => void reloadViewport().catch(() => undefined)}
        >
          <RotateCw size={14} />
        </IconButton>
        <IconButton
          size="small"
          aria-label="Hide viewport"
          title="Hide viewport"
          onClick={hideViewportDrawer}
        >
          <X size={14} />
        </IconButton>
      </header>
      <div ref={contentRef} className="min-h-0 flex-1 bg-muted/20">
        <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
          {!session ? "Viewport closed" : loading ? "Loading page…" : "Viewport hidden"}
        </div>
      </div>
    </aside>
  );
}
