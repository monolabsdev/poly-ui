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
        <Box>
          <Box>  
              <Box>
                <IconButton
                  onClick={dismiss}
                  size="small"
                  aria-label="Close"
                >
                  <X size={18} />
                </IconButton>

                <Box>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Box
                    >
                      <Sparkles size={18} />
                    </Box>
                    <Box>
                      <Typography>
                        What's new in Poly UI
                      </Typography>
                      {version && (
                        <Typography>
                          v{version}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </Box>

                <Box
                >
                  {loading ? (
                    <LoadingState />
                  ) : data?.ok ? (
                    <MarkdownProse content={data.body} />
                  ) : (
                    <FallbackState version={version} data={data} />
                  )}
                </Box>

                <Box
                >
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
    <Box>
      <Typography>
        {version ? `Poly UI v${version}` : "Poly UI"}
      </Typography>
      <Typography>
        {data === null
          ? "Release notes could not be loaded right now."
          : "No release notes available for this version."}
      </Typography>
    </Box>
  );
}
