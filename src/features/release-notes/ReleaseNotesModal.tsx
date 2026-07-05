import { useEffect } from "react";
import { Box } from "@/components/ui/Box";
import { Typography } from "@/components/ui/Typography";
import { Stack } from "@/components/ui/Stack";
import { Badge } from "@/components/ui/badge";
import { IconButton } from "@/components/ui/icon-button";
import { X, ExternalLink, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { openUrl } from "@tauri-apps/plugin-opener";
import { cn } from "@/lib/utils";
import { MarkdownProse } from "@/features/chat/components/Message/MarkdownProse";
import { useReleaseNotes } from "./useReleaseNotes";
import { RELEASES_URL, type Release } from "./releaseNotesApi";
import { fireConfettiBothSides } from "./confetti";

export function ReleaseNotesModal() {
  const { show, loading, releases, dismiss } = useReleaseNotes();

  useEffect(() => {
    if (!show) return;
    const timer = setTimeout(() => fireConfettiBothSides(), 300);
    return () => clearTimeout(timer);
  }, [show]);

  return (
    <Modal
      open={show}
      onOpenChange={(open) => { if (!open) dismiss(); }}
      maxWidth={640}
      showCloseButton={false}
    >
      {show && (
        <Box className="relative flex max-h-[76vh] flex-col">
          <Box className="flex items-start gap-3 p-6 pb-4">
            <Box className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Sparkles size={20} />
            </Box>
            <Box className="min-w-0 flex-1">
              <Typography variant="h4">What's New</Typography>
              <Typography variant="body2" color="muted">
                The latest updates to Poly UI
              </Typography>
            </Box>
            <IconButton onClick={dismiss} size="small" aria-label="Close">
              <X size={18} />
            </IconButton>
          </Box>

          <Box className="min-h-0 flex-1 overflow-y-auto px-6">
            {loading ? (
              <LoadingState />
            ) : releases.length > 0 ? (
              releases.map((release, i) => (
                <ReleaseSection key={release.version} release={release} latest={i === 0} />
              ))
            ) : (
              <Typography variant="body2" color="muted" className="py-6">
                Release notes could not be loaded right now.
              </Typography>
            )}
          </Box>

          <Box className="flex shrink-0 items-center justify-end gap-2 border-t border-border/60 p-4 px-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                const url = releases[0]?.htmlUrl ?? RELEASES_URL;
                void openUrl(url).catch(() => window.open(url, "_blank", "noopener,noreferrer"));
              }}
            >
              <ExternalLink size={14} />
              View on GitHub
            </Button>
            <Button variant="default" size="sm" onClick={dismiss}>
              Got it
            </Button>
          </Box>
        </Box>
      )}
    </Modal>
  );
}

function ReleaseSection({ release, latest }: { release: Release; latest: boolean }) {
  return (
    <Box className={cn("py-5", !latest && "border-t border-border/60")}>
      <Stack direction="row" spacing={1} alignItems="center" className="mb-3">
        <Badge variant={latest ? "default" : "secondary"}>v{release.version}</Badge>
        {latest && (
          <Badge variant="outline" className="text-primary">
            Latest
          </Badge>
        )}
        {release.publishedAt && (
          <Typography variant="caption" color="muted">
            {new Date(release.publishedAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </Typography>
        )}
      </Stack>
      <MarkdownProse content={release.body} />
    </Box>
  );
}

function LoadingState() {
  const widths = ["65%", "92%", "84%", "74%", "88%"];

  return (
    <Stack spacing={1.5} className="py-5">
      {widths.map((width, i) => (
        <Box
          key={i}
          className="h-3.5 animate-pulse rounded-full bg-muted"
          style={{ width }}
        />
      ))}
    </Stack>
  );
}
