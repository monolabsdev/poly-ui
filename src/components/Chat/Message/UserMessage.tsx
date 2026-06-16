import { useState, useEffect } from "react";
import { Box, Typography, IconButton, Tooltip, useTheme } from "@mui/material";
import { Paperclip, Copy, Check, MoreHorizontal, Brain, Trash2, Search } from "lucide-react";
import { isImageAttachment, createDataUrl, formatFileSize } from "@/lib/utils";
import { useNotify } from "@/hooks/useNotify";
import type { MessageProps } from "./types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  forgetMessageMemory,
  isMemoryUiEnabled,
  relatedMessageMemory,
  rememberMessageMemory,
} from "@/features/memory/messageMemoryActions";

export function UserMessage({ id, conversationId, content, attachments }: MessageProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";
  const [copied, setCopied] = useState(false);
  const notify = useNotify();

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

  const handleRemember = async () => {
    try {
      notify.success(await rememberMessageMemory({ messageId: id, conversationId, content }));
    } catch (error) {
      notify.error("Memory save failed", String(error));
    }
  };

  const handleForget = async () => {
    try {
      notify.success(await forgetMessageMemory({ messageId: id, content }));
    } catch (error) {
      notify.error("Memory delete failed", String(error));
    }
  };

  const handleRelated = async () => {
    try {
      const related = await relatedMessageMemory({ messageId: id, content });
      notify.info(
        related.length ? `${related.length} related ${related.length === 1 ? "memory" : "memories"}` : "No related memories",
        related.slice(0, 3).map((record) => record.summary).join("\n"),
      );
    } catch (error) {
      notify.error("Memory lookup failed", String(error));
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        alignItems: "flex-end",
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
                width: isImageAttachment(att.type) ? { xs: 80, sm: 120 } : "auto",
                height: isImageAttachment(att.type) ? { xs: 80, sm: 120 } : "auto",
                minWidth: isImageAttachment(att.type) ? 0 : { xs: 140, sm: 200 },
                borderRadius: "12px",
                overflow: "hidden",
                border: "1px solid",
                borderColor: "divider",
                bgcolor: "secondary.main",
                display: "flex",
                alignItems: "center",
                p: isImageAttachment(att.type) ? 0 : 1.5,
                gap: 1.5,
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
          bgcolor: isDark ? "grey.900" : "grey.100",
          border: "1px solid",
          borderColor: "border.light",
          px: 2.5,
          py: 1.5,
        }}
      >
        <Typography
          sx={{
            userSelect: "text",
            WebkitUserSelect: "text",
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

      <Box className="action-bar" sx={{ mt: 0.5, mr: 1 }}>
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
        {isMemoryUiEnabled() && (
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
              <DropdownMenuItem onClick={handleRemember} sx={{ gap: 2 }}>
                <Brain size={14} />
                Remember this
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleForget} sx={{ gap: 2 }}>
                <Trash2 size={14} />
                Forget this
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRelated} sx={{ gap: 2 }}>
                <Search size={14} />
                View related memories
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </Box>
    </Box>
  );
}
