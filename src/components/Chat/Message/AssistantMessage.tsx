import { useState, useEffect } from "react";
import {
  Copy,
  MoreHorizontal,
  RotateCcw,
  Check,
  AlertCircle,
  StopCircle,
  Volume2,
  Square,
} from "lucide-react";
import {
  Box,
  Typography,
  IconButton,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNotify } from "@/hooks/useNotify";

import { ThinkingDisclosure } from "./ThinkingDisclosure";
import { WebSearchDisclosure } from "./WebSearchDisclosure";
import { Source, SourceTrigger, SourceContent } from "@/components/ui/sources";

import type { MessageProps } from "./types";
import {
  useMessageStreaming,
  useMessageMarkdown,
  useMessageTts,
} from "./hooks";
import { MarkdownProse } from "./MarkdownProse";

export function AssistantMessage(props: MessageProps) {
  const {
    content,
    messageIndex,
    model,
    thinking,
    thinkingDuration,
    isThinking,
    isStreaming,
    status,
    errorMessage,
    onRegenerate,
    webSearch,
    isLastMessage,
  } = props;

  const [copied, setCopied] = useState(false);
  const [webSearchExpanded, setWebSearchExpanded] = useState(false);
  const notify = useNotify();

  const streamingDisplayContent = useMessageStreaming(content, isStreaming);
  const { processedContent, processedThinking } = useMessageMarkdown(
    content,
    thinking,
    isStreaming,
  );
  const { isSpeaking, isGenerating, handleSpeak } = useMessageTts(
    messageIndex,
    content,
  );

  const canRegenerate =
    typeof messageIndex === "number" && typeof onRegenerate === "function";

  useEffect(() => {
    if (!copied) return;
    const timeout = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timeout);
  }, [copied]);

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard
      ?.writeText(content)
      .then(() => {
        setCopied(true);
        notify.success("Copied to clipboard");
      })
      .catch(() => {
        notify.error("Failed to copy");
      });
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        py: 0.5,
        "& .action-bar": {
          opacity: 0,
        },
        "&:hover .action-bar, &:focus-within .action-bar": {
          opacity: 1,
        },
        "@media (hover: none)": {
          "& .action-bar": {
            opacity: 1,
          },
        },
      }}
    >
      <Box sx={{ width: "100%" }}>
        {model && (
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              fontWeight: 600,
              mb: 1,
              display: "block",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              fontSize: "10px",
            }}
          >
            {model}
          </Typography>
        )}

        {status === "error" && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1.5,
              mb: 2,
              p: 1.5,
              borderRadius: "12px",
              bgcolor: "error.soft",
              border: "1px solid",
              borderColor: "error.main",
              color: "error.main",
            }}
          >
            <AlertCircle size={18} />
            <Box>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  display: "block",
                  textTransform: "uppercase",
                  fontSize: "10px",
                }}
              >
                Generation Error
              </Typography>
              <Typography
                variant="body2"
                sx={{ fontSize: "13px", opacity: 0.9 }}
              >
                {errorMessage || "The provider encountered an issue."}
              </Typography>
              {onRegenerate && typeof messageIndex === "number" && (
                <IconButton
                  size="small"
                  onClick={() => onRegenerate(messageIndex)}
                  sx={{
                    mt: 1,
                    color: "error.main",
                    bgcolor: "rgba(248, 113, 113, 0.1)",
                    px: 2,
                    py: 0.5,
                    gap: 1,
                    "&:hover": { bgcolor: "rgba(248, 113, 113, 0.2)" },
                  }}
                >
                  <RotateCcw size={14} />
                  <Typography variant="caption" sx={{ fontWeight: 600 }}>
                    Retry
                  </Typography>
                </IconButton>
              )}
            </Box>
          </Box>
        )}

        {status === "aborted" && (
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: 1,
              mb: 1,
              color: "text.secondary",
              opacity: 0.7,
            }}
          >
            <StopCircle size={14} />
            <Typography
              variant="caption"
              sx={{ fontSize: "11px", fontWeight: 500 }}
            >
              Generation stopped by user
            </Typography>
          </Box>
        )}

        <ThinkingDisclosure
          thinking={thinking}
          isThinking={isThinking ?? false}
          thinkingDuration={thinkingDuration}
          processedThinking={processedThinking}
          status={status}
        />

        {webSearch && (
          <Box sx={{ mb: 0.5 }}>
            <WebSearchDisclosure
              isSearching={webSearch.status === "searching"}
              query={webSearch.query}
              results={webSearch.results}
              isExpanded={webSearchExpanded}
              onToggle={() => setWebSearchExpanded((v) => !v)}
            />
          </Box>
        )}

        {/* ── Markdown Core Message Body ── */}
        {content ? (
          <Box
            id={`message-${messageIndex}`}
            sx={{
              maxWidth: { xs: "90%", sm: "80%" },
              contentVisibility: "auto",
              containIntrinsicSize: "1px 5000px",
            }}
          >
            <MarkdownProse
              content={isStreaming ? streamingDisplayContent || "" : processedContent}
              streaming={isStreaming}
            />
          </Box>
        ) : null}

        {/* ── Source Badges ── */}
        {!isStreaming && webSearch?.results && webSearch.results.length > 0 && (
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 0.75,
                mt: 1.5,
                maxWidth: { xs: "90%", sm: "80%" },
              }}
            >
              {webSearch.results.map((result) => (
                <Source key={result.url} href={result.url}>
                  <SourceTrigger showFavicon />
                  <SourceContent
                    title={result.title}
                    description={result.highlights?.join(" ") || ""}
                  />
                </Source>
              ))}
            </Box>
          )}

        {/* ── Contextual Action Toolbar ── */}
        <Box
          className={!isLastMessage ? "action-bar" : undefined}
          sx={{
            display: "flex",
            gap: 0.5,
            mt: 1.5,
            ...(isLastMessage
              ? {
                  opacity: isStreaming ? 0 : 1,
                }
              : {}),
          }}
        >
          <Tooltip title={copied ? "Copied" : "Copy"}>
            <IconButton
              size="small"
              onClick={handleCopy}
              sx={{
                color: copied ? "success.main" : "text.secondary",
                "&:hover": {
                  color: copied ? "success.main" : "text.primary",
                  bgcolor: "action.hover",
                },
              }}
            >
                <Box
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 14,
                    height: 14,
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </Box>
            </IconButton>
          </Tooltip>

          {typeof messageIndex === "number" && (
            <Tooltip title={isSpeaking ? "Stop reading" : "Read message"}>
              <IconButton
                size="small"
                onClick={handleSpeak}
                disabled={isStreaming || (isGenerating && !isSpeaking)}
                sx={{
                  color: isSpeaking ? "primary.main" : "text.secondary",
                  "&:hover": {
                    color: isSpeaking ? "primary.main" : "text.primary",
                    bgcolor: "action.hover",
                  },
                }}
              >
                {isGenerating ? (
                  <CircularProgress size={14} color="inherit" />
                ) : isSpeaking ? (
                  <Square size={14} />
                ) : (
                  <Volume2 size={14} />
                )}
              </IconButton>
            </Tooltip>
          )}

          {canRegenerate && (
            <Tooltip title="Regenerate">
              <IconButton
                size="small"
                onClick={() => onRegenerate(messageIndex)}
                sx={{
                  color: "text.secondary",
                  "&:hover": { color: "text.primary", bgcolor: "action.hover" },
                }}
              >
                <RotateCcw size={14} />
              </IconButton>
            </Tooltip>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                size="small"
                sx={{
                  color: "text.secondary",
                  "&:hover": { color: "text.primary", bgcolor: "action.hover" },
                }}
              >
                <MoreHorizontal size={14} />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleCopy} sx={{ gap: 2 }}>
                <Copy size={14} />
                Copy message
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const plain = content
                    .replace(/[#*`~\[\]()>|\\]/g, "")
                    .replace(/\n{3,}/g, "\n\n");
                  navigator.clipboard.writeText(plain).then(() => {
                    notify.success("Copied as plain text");
                  });
                }}
                sx={{ gap: 2 }}
              >
                <Copy size={14} />
                Copy as plain text
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </Box>
      </Box>
    </Box>
  );
}
