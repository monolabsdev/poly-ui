import { useEffect, useRef } from "react";
import { Box, Typography, Stack, IconButton } from "@mui/material";
import { motion, AnimatePresence, useReducedMotion } from "motion/react";
import { X, ExternalLink, Sparkles } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { MarkdownProse } from "@/components/Chat/Message/MarkdownProse";
import { MOTION_TOKENS } from "@/lib/motion";
import { useReleaseNotes } from "./useReleaseNotes";
import type { ReleaseNotesResult } from "./releaseNotesApi";
import { fireConfettiBothSides } from "./confetti";

const VARIANTS = {
  overlay: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  panel: {
    initial: { opacity: 0, scale: 0.96, y: 12 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.96, y: 12 },
  },
};

export function ReleaseNotesModal() {
  const { show, loading, data, version, isFirstLaunchForVersion, dismiss } = useReleaseNotes();
  const prefersReducedMotion = useReducedMotion();
  const confettiFiredRef = useRef(false);

  const shouldShowConfetti =
    show &&
    isFirstLaunchForVersion &&
    data?.ok === true &&
    (data.ok ? data.body.trim().length > 0 : false) &&
    !prefersReducedMotion;

  useEffect(() => {
    if (shouldShowConfetti && !confettiFiredRef.current) {
      confettiFiredRef.current = true;
      const timer = setTimeout(() => fireConfettiBothSides(), 300);
      return () => clearTimeout(timer);
    }
    if (!show) {
      confettiFiredRef.current = false;
    }
  }, [shouldShowConfetti, show]);

  return (
    <Modal open={show} onOpenChange={(open) => { if (!open) dismiss(); }} maxWidth={600} showCloseButton={false}>
      <AnimatePresence mode="wait">
        {show && (
          <motion.div
            key="release-notes"
            variants={VARIANTS.overlay}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: MOTION_TOKENS.duration.base, ease: MOTION_TOKENS.ease.out }}
            style={{ display: "contents" }}
          >
            <motion.div
              variants={VARIANTS.panel}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: MOTION_TOKENS.duration.slow, ease: MOTION_TOKENS.ease.out, delay: 0.04 }}
            >
              <Box sx={{ position: "relative", display: "flex", flexDirection: "column", maxHeight: "80vh" }}>
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
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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
