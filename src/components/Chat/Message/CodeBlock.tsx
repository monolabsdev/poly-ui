import { memo, useRef, useState, useEffect } from "react";
import { Box, IconButton, Tooltip, useTheme } from "@mui/material";
import { Copy, Check } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { ANIMATION_VARIANTS } from "@/lib/motion";
import { useNotify } from "@/hooks/useNotify";

const SHIKI_THEMES: Record<string, string> = {
  light: "one-light",
  dark: "one-dark-pro",
};

export const CodeBlock = memo(function CodeBlock({
  value,
  language,
}: {
  value: string;
  language?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useNotify();
  const theme = useTheme();
  const themeKey = theme.palette.mode;
  const actualTheme = SHIKI_THEMES[themeKey];
  const overlayBackground =
    themeKey === "dark" ? "rgba(30, 30, 30, 0.45)" : "rgba(255, 255, 255, 0.75)";
  const overlayHoverBackground =
    themeKey === "dark" ? "rgba(30, 30, 30, 0.75)" : "rgba(255, 255, 255, 0.95)";
  const overlayColor =
    themeKey === "dark" ? "rgba(255, 255, 255, 0.6)" : "rgba(17, 24, 39, 0.68)";
  const overlayHoverColor =
    themeKey === "dark" ? "rgba(255, 255, 255, 0.95)" : "rgba(17, 24, 39, 0.95)";
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function highlight() {
      if (!value) {
        setHighlightedHtml("<pre><code></code></pre>");
        return;
      }
      const { codeToHtml } = await import("shiki");
      const html = await codeToHtml(value, {
        lang: language || "text",
        theme: actualTheme,
      });
      if (!cancelled) setHighlightedHtml(html);
    }
    highlight();
    return () => { cancelled = true; };
  }, [value, language, actualTheme]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleCopy = () => {
    navigator.clipboard
      ?.writeText(value)
      .then(() => {
        setCopied(true);
        notify.success("Copied to clipboard");
        if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
        copiedTimerRef.current = setTimeout(() => {
          copiedTimerRef.current = null;
          setCopied(false);
        }, 2000);
      })
      .catch(() => {
        notify.error("Failed to copy");
      });
  };

  return (
    <Box
      sx={{
        position: "relative",
        my: 2,
        borderRadius: "8px",
        overflow: "hidden",
        "&:hover .copy-button": { opacity: 1 },
        "& pre": {
          m: 0,
          p: { xs: 1.5, sm: 2.5 },
          fontSize: { xs: "12px", sm: "13px" },
          lineHeight: 1.5,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          overflow: "auto",
          maxWidth: "100%",
        },
        "& code": {
          fontFamily: "inherit",
          fontSize: "inherit",
          bgcolor: "transparent",
          px: 0,
          py: 0,
        },
      }}
    >
      <Tooltip title={copied ? "Copied!" : "Copy code"}>
        <IconButton
          component={motion.button}
          variants={ANIMATION_VARIANTS.interactive}
          whileHover="hover"
          whileTap="tap"
          className="copy-button"
          size="small"
          onClick={handleCopy}
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            zIndex: 10,
            color: overlayColor,
            bgcolor: overlayBackground,
            backdropFilter: "blur(4px)",
            opacity: 0,
            transition:
              "opacity 0.18s ease, background-color 0.18s ease, color 0.18s ease",
            "&:hover": {
              color: overlayHoverColor,
              bgcolor: overlayHoverBackground,
            },
            "@media (hover: none)": {
              opacity: 1,
            },
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={copied ? "check" : "copy"}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.12 }}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </motion.div>
          </AnimatePresence>
        </IconButton>
      </Tooltip>

      {highlightedHtml ? (
        <Box
          sx={{
            bgcolor: theme.palette.mode === "dark" ? "grey.900" : "grey.100",
            color: "text.primary",
            "& pre": {
              bgcolor: "transparent !important",
            },
            "& code": {
              bgcolor: "transparent !important",
            },
          }}
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      ) : (
        <Box
          component="pre"
          sx={{
            bgcolor: theme.palette.mode === "dark" ? "grey.900" : "grey.100",
            color: "text.primary",
          }}
        >
          <code>{value}</code>
        </Box>
      )}
    </Box>
  );
});
