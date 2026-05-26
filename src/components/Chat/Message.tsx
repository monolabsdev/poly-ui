import type { Role, Attachment, WebSearchEvent } from "@/types/chat";
import {
  Copy,
  MoreHorizontal,
  RotateCcw,
  Check,
  Paperclip,
  AlertCircle,
  StopCircle,
  Volume2,
  Square,
} from "lucide-react";
import { memo, useState, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import ThinkingIndicator from "./ThinkingIndicator";
import WebSearchDisclosure from "./WebSearchDisclosure";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import "katex/dist/katex.min.css";
import { Box, Typography, IconButton, Tooltip, Collapse, CircularProgress } from "@mui/material";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { isImageAttachment, createDataUrl, formatFileSize } from "@/lib/utils";
import { motion, AnimatePresence } from "motion/react";
import { useTiming, ANIMATION_VARIANTS } from "@/lib/motion";
import { useNotify } from "@/hooks/useNotify";
import { useTtsStore } from "@/store/ttsStore";

export interface MessageProps {
  role: Role;
  content: string;
  attachments?: Attachment[];
  messageIndex?: number;
  model?: string;
  thinking?: string;
  thinkingDuration?: number;
  isThinking?: boolean;
  isStreaming?: boolean;
  status?: "queued" | "streaming" | "complete" | "error" | "aborted";
  errorMessage?: string;
  onRegenerate?: (messageIndex: number) => void;
  webSearch?: WebSearchEvent;
}

const CodeBlock = memo(function CodeBlock({
  value,
}: {
  value: string;
  language?: string | null;
}) {
  const [copied, setCopied] = useState(false);
  const notify = useNotify();

  const handleCopy = () => {
    navigator.clipboard
      ?.writeText(value)
      .then(() => {
        setCopied(true);
        notify.success("Copied to clipboard");
        setTimeout(() => setCopied(false), 2000);
      })
      .catch(() => {
        notify.error("Failed to copy");
      });
  };

  return (
    <Box sx={{ position: "relative", "&:hover .copy-button": { opacity: 1 } }}>
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
            color: "rgba(255, 255, 255, 0.4)",
            bgcolor: "rgba(30, 30, 30, 0.4)",
            backdropFilter: "blur(4px)",
            opacity: 0,
            transition:
              "opacity 0.18s ease, background-color 0.18s ease, color 0.18s ease",
            "&:hover": {
              color: "rgba(255, 255, 255, 0.9)",
              bgcolor: "rgba(30, 30, 30, 0.7)",
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
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </motion.div>
          </AnimatePresence>
        </IconButton>
      </Tooltip>
      <Box
        component="pre"
        sx={{
          bgcolor: "#1e1e1e",
          color: "#d4d4d4",
          p: 2.5,
          borderRadius: "8px",
          overflow: "auto",
          fontSize: "13px",
          lineHeight: 1.5,
          fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
          m: 0,
          "& code": {
            fontFamily: "inherit",
            fontSize: "inherit",
            bgcolor: "transparent",
            px: 0,
            py: 0,
          },
        }}
      >
        <code>{value}</code>
      </Box>
    </Box>
  );
});

export const Message = memo(function Message({
  role,
  content,
  attachments,
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
}: MessageProps) {
  const [copied, setCopied] = useState(false);
  const [thinkingExpanded, setThinkingExpanded] = useState(isThinking || false);
  const [webSearchExpanded, setWebSearchExpanded] = useState(false);
  const isUser = role === "user";
  const timing = useTiming();
  const notify = useNotify();

  const activeMessageId = useTtsStore((s) => s.activeMessageId);
  const isPlaying = useTtsStore((s) => s.isPlaying);
  const isGenerating = useTtsStore((s) => s.isGenerating);
  const ttsActions = useTtsStore((s) => s.actions);
  const isSpeaking = typeof messageIndex === "number" && activeMessageId === messageIndex && isPlaying;
  const isActiveTts = typeof messageIndex === "number" && activeMessageId === messageIndex && isGenerating;

  const handleSpeak = () => {
    if (typeof messageIndex !== "number") return;
    if (isSpeaking || isActiveTts) {
      ttsActions.stop();
    } else {
      ttsActions.play(messageIndex, content).catch((err) => {
        notify.error("TTS error", err?.message ?? String(err));
      });
    }
  };

  const stripInvisible = (s: string) =>
    s.replace(/[\u200B-\u200D\uFEFF\u00AD\u2060\u2061\u2062\u2063\u2064]/g, "");

  const processedContent = useMemo(() => {
    if (!content || isStreaming) return content || "";
    return stripInvisible(content)
      .replace(/\\\[/g, "$$$$")
      .replace(/\\\]/g, "$$$$")
      .replace(/\\\(/g, "$")
      .replace(/\\\)/g, "$");
  }, [content, isStreaming]);

  const processedThinking = useMemo(() => {
    if (!thinking || isStreaming) return thinking || "";
    return stripInvisible(thinking)
      .replace(/\\\[/g, "$$$$")
      .replace(/\\\]/g, "$$$$")
      .replace(/\\\(/g, "$")
      .replace(/\\\)/g, "$");
  }, [thinking, isStreaming]);

  const markdownComponents = useMemo(
    () => ({
      pre: ({ children }: any) => <>{children}</>,
      code({ inline, className, children, ...props }: any) {
        const match = /language-(\w+)/.exec(className || "");
        if (!inline) {
          return (
            <CodeBlock
              language={match ? match[1] : null}
              value={String(children).replace(/\n$/, "")}
              {...props}
            />
          );
        }
        return (
           <code className={className} {...props}>
            {children}
          </code>
        );
      },
    }),
    [],
  );

  useEffect(() => {
    if (isThinking) {
      setThinkingExpanded(true);
    }
  }, [isThinking]);

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

  if (isUser) {
    return (
      <Box
        component={motion.div}
        variants={ANIMATION_VARIANTS.messageTurn}
        initial="initial"
        animate="animate"
        exit="exit"
        transition={{ duration: timing.duration("base"), ease: timing.ease }}
        sx={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          alignItems: "flex-end",
          py: 0.5,
        }}
      >
        {attachments && attachments.length > 0 && (
          <Box
            sx={{
              display: "flex",
              flexWrap: "wrap",
              gap: 1,
              mb: 1,
              maxWidth: { xs: "85%", sm: "70%" },
            }}
          >
            {attachments.map((att) => (
              <Box
                key={att.id}
                sx={{
                  width: isImageAttachment(att.type) ? 120 : "auto",
                  height: isImageAttachment(att.type) ? 120 : "auto",
                  minWidth: isImageAttachment(att.type) ? 0 : 200,
                  borderRadius: "12px",
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: "divider",
                  bgcolor: "secondary.main",
                  display: "flex",
                  alignItems: "center",
                  p: isImageAttachment(att.type) ? 0 : 1.5,
                  gap: 1.5,
                  transition:
                    "background-color 0.18s ease, border-color 0.18s ease",
                }}
              >
                {isImageAttachment(att.type) ? (
                  <img
                    src={createDataUrl(att.type, att.content || "")}
                    alt={att.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                ) : (
                  <>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1,
                        bgcolor: "action.hover",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Paperclip size={20} />
                    </Box>
                    <Box sx={{ overflow: "hidden" }}>
                      <Typography
                        variant="body2"
                        sx={{
                          fontWeight: 500,
                          color: "text.primary",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {att.name}
                      </Typography>
                      <Typography
                        variant="caption"
                        sx={{ color: "text.secondary" }}
                      >
                        {formatFileSize(att.size)}
                      </Typography>
                    </Box>
                  </>
                )}
              </Box>
            ))}
          </Box>
        )}
        <Box
          sx={{
            maxWidth: { xs: "85%", sm: "70%" },
            borderRadius: "24px",
            bgcolor: "chat.bubbleUser",
            border: "1px solid",
            borderColor: "border.light",
            px: 2.5,
            py: 1.5,
            transition: "background-color 0.18s ease, border-color 0.18s ease",
          }}
        >
          <Typography
            sx={{
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              lineHeight: 1.6,
              fontSize: "15.5px",
              color: "text.primary",
            }}
          >
            {content}
          </Typography>
        </Box>
      </Box>
    );
  }

  return (
    <Box
      component={motion.div}
      variants={ANIMATION_VARIANTS.messageTurn}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: timing.duration("base"), ease: timing.ease }}
      sx={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        py: 0.5,
        "& .action-bar": {
          opacity: 0,
          transition: "opacity 0.2s",
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
                    borderRadius: "8px",
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

        {(thinking || isThinking) && (
          <Box
            sx={{ maxWidth: isUser ? "100%" : { xs: "90%", sm: "80%" } }}
          >
            <Box onClick={() => setThinkingExpanded(!thinkingExpanded)}>
              <ThinkingIndicator
                isActive={isThinking}
                isExpanded={thinkingExpanded}
                thinkingDuration={thinkingDuration}
              />
            </Box>
            <Collapse in={thinkingExpanded}>
              <Box
                sx={{
                  mt: 1,
                  mb: 1,
                  pl: 2,
                  borderLeft: "2px solid",
                  borderColor: "divider",
                }}
              >
                <Box
                  sx={{
                    color: "text.secondary",
                    fontSize: "14px",
                    lineHeight: 1.6,
                    "& p": { mb: 1, "&:last-child": { mb: 0 } },
                    "& pre": {
                      mb: 2,
                      p: 0,
                      borderRadius: "8px",
                      overflow: "hidden",
                    },
                    "& code": { fontFamily: "monospace", fontSize: "0.9em" },
                    "& code.inline-code": {
                      bgcolor: "action.hover",
                      px: 0.6,
                      py: 0.2,
                      borderRadius: "4px",
                    },
                  }}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm, remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={markdownComponents}
                  >
                    {processedThinking}
                  </ReactMarkdown>
                </Box>
              </Box>
            </Collapse>
          </Box>
        )}

        {webSearch && webSearch.status !== "searching" && (
          <Box sx={{ mb: 0.5 }}>
            <WebSearchDisclosure
              isSearching={false}
              query={webSearch.query}
              results={webSearch.results}
              isExpanded={webSearchExpanded}
              onToggle={() => setWebSearchExpanded(!webSearchExpanded)}
            />
          </Box>
        )}

        {content ? (
          <Box
            id={`message-${messageIndex}`}
            sx={{
              color: "text.primary",
              fontSize: "15px",
              lineHeight: 1.6,
              maxWidth: isUser ? "100%" : { xs: "90%", sm: "80%" },
              contentVisibility: "auto",
              containIntrinsicSize: "1px 240px",
              "& p": {
                mb: 2,
                "&:last-child": { mb: 0 },
                lineHeight: 1.6,
                fontSize: "15px",
              },
              "& pre": { mb: 2, p: 0, borderRadius: "8px", overflow: "hidden" },
              "& code": { fontFamily: "monospace", fontSize: "0.9em" },
              "& code.inline-code": {
                bgcolor: "action.hover",
                px: 0.6,
                py: 0.2,
                borderRadius: "4px",
              },
              "& ul, & ol": { pl: 3, mb: 2 },
              "& li": { mb: 0.5 },
              "& blockquote": {
                borderLeft: "4px solid",
                borderColor: "divider",
                pl: 2,
                fontStyle: "italic",
                color: "text.secondary",
                mb: 2,
              },
              "& table": {
                width: "100%",
                borderCollapse: "collapse",
                mb: 2,
                border: "1px solid",
                borderColor: "divider",
              },
              "& th, & td": {
                border: "1px solid",
                borderColor: "divider",
                p: 1,
                textAlign: "left",
              },
              "& th": { bgcolor: "action.hover", fontWeight: 600 },
            }}
          >
            {isStreaming ? (
              <Typography
                component="div"
                sx={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  lineHeight: 1.6,
                  fontSize: "15px",
                }}
              >
                {content}
              </Typography>
            ) : (
              <ReactMarkdown
                remarkPlugins={[remarkGfm, remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={markdownComponents}
              >
                {processedContent}
              </ReactMarkdown>
            )}
          </Box>
        ) : null}

        <Box
          className="action-bar"
        >
          <Tooltip title={copied ? "Copied" : "Copy"}>
            <IconButton
              component={motion.button}
              variants={ANIMATION_VARIANTS.interactive}
              whileHover="hover"
              whileTap="tap"
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
              <AnimatePresence mode="wait">
                <motion.div
                  key={copied ? "check" : "copy"}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.12 }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </motion.div>
              </AnimatePresence>
            </IconButton>
          </Tooltip>

          {typeof messageIndex === "number" && (
            <Tooltip title={isSpeaking ? "Stop reading" : "Read message"}>
              <IconButton
                component={motion.button}
                variants={ANIMATION_VARIANTS.interactive}
                whileHover="hover"
                whileTap="tap"
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
                component={motion.button}
                variants={ANIMATION_VARIANTS.interactive}
                whileHover="hover"
                whileTap="tap"
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
                component={motion.button}
                variants={ANIMATION_VARIANTS.interactive}
                whileHover="hover"
                whileTap="tap"
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
              <DropdownMenuItem
                onClick={handleCopy}
                sx={{ gap: 2 }}
              >
                <Copy size={14} />
                Copy message
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  const plain = content.replace(/[#*`~\[\]()>|\\]/g, "").replace(/\n{3,}/g, "\n\n");
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
});
