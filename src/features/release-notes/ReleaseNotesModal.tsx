import { useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import IconButton from "@mui/material/IconButton";
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
      contentSx={{ overflow: "hidden", flex: "0 1 auto" }}
    >
      {show && (
        <Box>
          <Box>  
              <Box sx={{ position: "relative", display: "flex", flexDirection: "column", maxHeight: "calc(100vh - var(--titlebar-height) - 32px)" }}>
                <IconButton
                  onClick={dismiss}
                  size="small"
                  aria-label="Close"
                  sx={{
                    position: "absolute",
                    top: 16,
                    right: 16,
                    zIndex: 1,
                    color: "text.secondary",
                    "&:hover": { bgcolor: "action.hover", color: "text.primary" },
                  }}
                >
                  <X size={18} />
                </IconButton>

                <Box sx={{ px: 3, pt: 3, pb: 2 }}>
                  <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1.5 }}>
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: "10px",
                        bgcolor: "primary.main",
                        color: "primary.contrastText",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Sparkles size={18} />
                    </Box>
                    <Box>
                      <Typography sx={{ fontSize: 16, fontWeight: 700, lineHeight: 1.3 }}>
                        What's new in Poly UI
                      </Typography>
                      {version && (
                        <Typography sx={{ fontSize: 12, color: "text.secondary", lineHeight: 1.3 }}>
                          v{version}
                        </Typography>
                      )}
                    </Box>
                  </Stack>
                </Box>

                <Box
                  sx={{
                    flex: 1,
                    overflowY: "auto",
                    minHeight: 0,
                    px: 3,
                    pb: 2,
                  }}
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
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: 1.5,
                    px: 3,
                    py: 2,
                    borderTop: "1px solid",
                    borderColor: "divider",
                    flexShrink: 0,
                  }}
                >
                  {data?.ok && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open((data as Extract<typeof data, { ok: true }>).htmlUrl, "_blank")}
                      sx={{ gap: 1 }}
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
          sx={{
            height: i === 0 ? 20 : 12,
            width,
            borderRadius: "4px",
            bgcolor: "action.hover",
            animation: "pulse 1.5s ease-in-out infinite",
            opacity: 1 - i * 0.12,
          }}
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
    <Box sx={{ textAlign: "center", py: 4 }}>
      <Typography sx={{ color: "text.primary", fontSize: 15, fontWeight: 600, mb: 1 }}>
        {version ? `Poly UI v${version}` : "Poly UI"}
      </Typography>
      <Typography sx={{ color: "text.secondary", fontSize: 13, lineHeight: 1.6 }}>
        {data === null
          ? "Release notes could not be loaded right now."
          : "No release notes available for this version."}
      </Typography>
    </Box>
  );
}
