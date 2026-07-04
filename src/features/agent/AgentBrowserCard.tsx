import { useEffect, useState } from "react";
import { Globe, Loader2, RotateCw, X } from "lucide-react";
import { Box } from "@/components/ui/Box";
import { Typography } from "@/components/ui/Typography";
import { IconButton } from "@/components/ui/icon-button";
import { closeViewport, reloadViewport, showViewportDrawer, useViewportStore } from "./viewportStore";

const SLOW_LOAD_HINT_MS = 15_000;

/** In-chat controller for the native agent preview window. */
export function AgentBrowserCard({ runId }: { runId?: string }) {
  const session = useViewportStore((state) => state.session);
  const [slow, setSlow] = useState(false);

  const loading = session?.status === "loading";
  useEffect(() => {
    setSlow(false);
    if (!loading) return;
    const timer = setTimeout(() => setSlow(true), SLOW_LOAD_HINT_MS);
    return () => clearTimeout(timer);
  }, [loading, session?.url]);

  if (!session || !runId || session.runId !== runId) return null;

  return (
    <Box className="mb-3 rounded-2xl border border-border/70 bg-muted/30 px-3 py-2">
      <Box className="flex items-center gap-3">
        <Box className="flex size-7 shrink-0 items-center justify-center rounded-full bg-background/70 text-muted-foreground">
          {loading ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
        </Box>
        <Box className="min-w-0 flex-1">
          <Typography className="truncate text-sm font-medium text-foreground">
            {session.label || session.url}
          </Typography>
          <Typography className="truncate text-xs text-muted-foreground">
            {loading
              ? slow
                ? "Still loading — the page may be unreachable."
                : "Loading preview..."
              : session.reason || "Viewport open"}
          </Typography>
        </Box>
        <Box className="shrink-0 rounded-full bg-background/70 px-2 py-1 text-xs text-muted-foreground">
          Opened by agent
        </Box>
        <IconButton
          size="small"
          aria-label="Reload preview"
          title="Reload preview"
          onClick={() => void reloadViewport().catch(() => undefined)}
        >
          <RotateCw size={14} />
        </IconButton>
        <IconButton
          size="small"
          aria-label="Show viewport"
          title="Show viewport"
          onClick={showViewportDrawer}
        >
          <Globe size={14} />
        </IconButton>
        <IconButton
          size="small"
          aria-label="Close preview"
          title="Close preview"
          onClick={() => void closeViewport()}
        >
          <X size={14} />
        </IconButton>
      </Box>
    </Box>
  );
}
