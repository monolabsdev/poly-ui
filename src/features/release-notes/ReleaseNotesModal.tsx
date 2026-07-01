import { useEffect } from "react";
import { Box } from "@/components/ui/Box";
import { Typography } from "@/components/ui/Typography";
import { Stack } from "@/components/ui/Stack";
import { IconButton } from "@/components/ui/icon-button";
import { X, ExternalLink, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { MarkdownProse } from "@/features/chat/components/Message/MarkdownProse";
import { useReleaseNotes } from "./useReleaseNotes";
import type { ReleaseNotesResult } from "./releaseNotesApi";
import { fireConfettiBothSides } from "./confetti";

export function ReleaseNotesModal() {
  const { show, loading, data, version, dismiss } = useReleaseNotes();


  useEffect(() => {
    if (!show) {
      return;
    }

    const timer = setTimeout(() => fireConfettiBothSides(), 300);
    return () => clearTimeout(timer);
  }, [show]);

  return (
    <Modal
      open={show}
      onOpenChange={(open) => { if (!open) dismiss(); }}
      maxWidth={600}
      showCloseButton={false}
    >
      {show && (
        <Box className="relative flex max-h-[70vh] flex-col gap-4 p-6">
          <IconButton
            onClick={dismiss}
            size="small"
            aria-label="Close"
            className="absolute top-4 right-4"
          >
            <X size={18} />
          </IconButton>

          <Stack direction="row" spacing={1.5} alignItems="center">
            <Box className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
              <Sparkles size={18} />
            </Box>
            <Box>
              <Typography variant="subtitle1">
                What's new in Poly UI
              </Typography>
              {version && (
                <Typography variant="caption" color="muted">
                  v{version}
                </Typography>
              )}
            </Box>
          </Stack>

          <Box className="min-h-0 flex-1 overflow-y-auto pr-1">
            {loading ? (
              <LoadingState />
            ) : data?.ok ? (
              <MarkdownProse content={data.body} />
            ) : (
              <FallbackState version={version} data={data} />
            )}
          </Box>

          <Box className="flex items-center justify-end gap-2 border-t border-border/60 pt-4">
            {data?.ok && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open((data as Extract<typeof data, { ok: true }>).htmlUrl, "_blank")}
              >
                <ExternalLink size={14} />
                View on GitHub
              </Button>
            )}
            <Button variant="default" size="sm" onClick={dismiss}>
              Got it
            </Button>
          </Box>
        </Box>
      )}
    </Modal>
  );
}

function LoadingState() {
  const widths = ["65%", "92%", "84%", "74%", "88%"];

  return (
    <Stack spacing={1.5}>
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

function FallbackState({
  version,
  data,
}: {
  version: string | null;
  data: ReleaseNotesResult | null;
}) {
  return (
    <Box className="flex flex-col gap-1">
      <Typography variant="subtitle2">
        {version ? `Poly UI v${version}` : "Poly UI"}
      </Typography>
      <Typography variant="body2" color="muted">
        {data === null
          ? "Release notes could not be loaded right now."
          : "No release notes available for this version."}
      </Typography>
    </Box>
  );
}
