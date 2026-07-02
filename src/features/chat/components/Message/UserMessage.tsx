import { useState, useEffect } from "react";
import { Box } from "@/components/ui/Box";
import { Typography } from "@/components/ui/Typography";
import { IconButton } from "@/components/ui/icon-button";
import { TooltipLabel as Tooltip } from "@/components/ui/tooltip-label";

import { Paperclip, Copy, Check, MoreHorizontal, Brain, Trash2, Search } from "lucide-react";
import { isImageAttachment, createDataUrl, formatFileSize } from "@/lib/utils/utils";
import { useNotify } from "@/hooks/useNotify";
import { cn } from "@/lib/utils";
import type { MessageProps } from "./types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  forgetMessageMemory,
  rememberMessageMemory,
} from "@/features/memory/messageMemoryActions";
import { openMemoryPanel } from "@/features/memory/MemoryPanel";
import { useSettingsStore } from "@/store/settingsStore";

export function UserMessage({ id, conversationId, content, attachments }: MessageProps) {
  const [copied, setCopied] = useState(false);
  const notify = useNotify();
  const memoryUiEnabled = useSettingsStore((state) => state.general.experimentalFeatures);

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


  return (
    <Box
      className="group/message ml-auto flex w-fit max-w-[min(82%,48rem)] flex-col items-end gap-2"
    >
      {attachments && attachments.length > 0 && (
        <Box
          className="grid max-w-full grid-cols-2 gap-2"
        >
          {attachments.map((att) => (
            <Box
              key={att.id}
              className={cn(
                "flex min-w-0 overflow-hidden rounded-2xl border border-border/50 bg-card text-card-foreground",
                isImageAttachment(att.type) && "size-32",
              )}
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
                    className="flex size-10 shrink-0 items-center justify-center text-muted-foreground"
                  >
                    <Paperclip size={20} />
                  </Box>
                  <Box>
                    <Typography
                      variant="body2"
                      noWrap
                    >
                      {att.name}
                    </Typography>
                    <Typography
                      variant="caption"
                      color="text.secondary"
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
        className="rounded-2xl rounded-br-sm bg-muted/70 px-3 py-2 text-foreground"
      >
        <Typography
          className="whitespace-pre-wrap text-sm leading-6"
        >
          {content}
        </Typography>
      </Box>

      <Box className="action-bar flex items-center gap-1 pr-1 text-muted-foreground transition-opacity">
        <Tooltip title={copied ? "Copied" : "Copy"}>
          <IconButton
            size="small"
            onClick={handleCopy}
            className="size-7 rounded-full"
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
        {memoryUiEnabled && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <IconButton
                size="small"
                className="size-7 rounded-full"
              >
                <MoreHorizontal size={14} />
              </IconButton>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleRemember}>
                <Brain size={14} />
                Remember this
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleForget}>
                <Trash2 size={14} />
                Forget this
              </DropdownMenuItem>
              <DropdownMenuItem onClick={openMemoryPanel}>
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
