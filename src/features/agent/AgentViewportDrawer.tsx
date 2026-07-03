import { useEffect, type PointerEvent as ReactPointerEvent } from "react";
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

export function AgentViewportDrawer() {
  const session = useViewportStore((state) => state.session);
  const open = useViewportStore((state) => state.drawerOpen);
  const width = useViewportStore((state) => state.drawerWidth);
  const reloadSeq = useViewportStore((state) => state.reloadSeq);
  const setDrawerWidth = useViewportStore((state) => state.actions.setDrawerWidth);

  useEffect(() => {
    if (!session || !open) {
      void native.agentViewportHide().catch(() => undefined);
    }
  }, [open, session]);

  const startResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);

    const onMove = (move: globalThis.PointerEvent) => {
      const next = Math.min(VIEWPORT_MAX_WIDTH, Math.max(VIEWPORT_MIN_WIDTH, startWidth + startX - move.clientX));
      setDrawerWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  };

  const loading = session?.status === "loading";

  return (
    <aside
      aria-label="Agent viewport"
      className={cn(
        "absolute inset-y-0 right-0 z-30 flex min-h-0 flex-col border-l border-border bg-background shadow-lg transition-transform duration-200 ease-out",
        open && session ? "translate-x-0" : "translate-x-full",
      )}
      style={{ width }}
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
          <div className="text-xs text-muted-foreground">
            {loading ? "Loading" : "Opened by Agent"}
          </div>
        </div>
        <span className="shrink-0 rounded-full border border-border bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          Opened by Agent
        </span>
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
      <div className="min-h-0 flex-1 bg-muted/20">
        {session?.url && open ? (
          <iframe
            key={`${session.url}:${reloadSeq}`}
            title="Agent viewport preview"
            src={session.url}
            className="h-full w-full border-0 bg-background"
            sandbox="allow-forms allow-modals allow-popups allow-same-origin allow-scripts"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            {!session ? "Viewport closed" : "Viewport hidden"}
          </div>
        )}
      </div>
    </aside>
  );
}
