import { memo, useEffect, useMemo, useRef, useState } from "react";
import { Box, IconButton, Tooltip, useTheme } from "@mui/material";
import { Copy, Check } from "lucide-react";
import { highlight } from "sugar-high";
import * as presets from "sugar-high/presets";
import { useNotify } from "@/hooks/useNotify";

const LANGUAGE_PRESETS = {
  c: presets.c,
  css: presets.css,
  diff: presets.diff,
  go: presets.go,
  java: presets.java,
  py: presets.python,
  python: presets.python,
  rs: presets.rust,
  rust: presets.rust,
} as const;

const JAVASCRIPT_LANGUAGES = new Set([
  "js",
  "javascript",
  "jsx",
  "ts",
  "tsx",
  "typescript",
]);

function getHighlightedHtml(value: string, language?: string | null): string | null {
  const normalizedLanguage = language?.toLowerCase();
  if (!normalizedLanguage) return null;
  if (JAVASCRIPT_LANGUAGES.has(normalizedLanguage)) return highlight(value);

  const preset = LANGUAGE_PRESETS[normalizedLanguage as keyof typeof LANGUAGE_PRESETS];
  return preset ? highlight(value, preset) : null;
};

export const CodeBlock = memo(function CodeBlock({
  code,
  language,
}: {
  code: string;
  language?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useNotify();
  const theme = useTheme();
  const themeKey = theme.palette.mode;
  const overlayBackground =
    themeKey === "dark" ? "rgba(30, 30, 30, 0.45)" : "rgba(255, 255, 255, 0.75)";
  const overlayHoverBackground =
    themeKey === "dark" ? "rgba(30, 30, 30, 0.75)" : "rgba(255, 255, 255, 0.95)";
  const overlayColor =
    themeKey === "dark" ? "rgba(255, 255, 255, 0.6)" : "rgba(17, 24, 39, 0.68)";
  const overlayHoverColor =
    themeKey === "dark" ? "rgba(255, 255, 255, 0.95)" : "rgba(17, 24, 39, 0.95)";
  const highlightedHtml = useMemo(() => getHighlightedHtml(code, language), [code, language]);

  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleCopy = () => {
    navigator.clipboard
      ?.writeText(code)
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
            "&:hover": {
              color: overlayHoverColor,
              bgcolor: overlayHoverBackground,
            },
            "@media (hover: none)": {
              opacity: 1,
            },
          }}
        >
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </Box>
        </IconButton>
      </Tooltip>

      {highlightedHtml ? (
        <Box
          component="pre"
          sx={{
            bgcolor: theme.palette.mode === "dark" ? "grey.900" : "grey.100",
            color: "text.primary",
            "& code": {
              bgcolor: "transparent !important",
            },
          }}
        >
          <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
        </Box>
      ) : (
        <Box
          component="pre"
          sx={{
            bgcolor: theme.palette.mode === "dark" ? "grey.900" : "grey.100",
            color: "text.primary",
          }}
        >
          <code>{code}</code>
        </Box>
      )}
    </Box>
  );
});
