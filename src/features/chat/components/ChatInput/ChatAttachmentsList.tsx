import { Paperclip, X } from "lucide-react";
import { memo } from "react";
import { Box } from "@/components/ui/Box";
import { IconButton } from "@/components/ui/icon-button";
import { Attachment } from "@/types/chat";
import { createDataUrl } from "@/lib/utils/utils";

interface ChatAttachmentsListProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

export const ChatAttachmentsList = memo(function ChatAttachmentsList({
  attachments,
  onRemove,
}: ChatAttachmentsListProps) {
  if (attachments.length === 0) return null;

  return (
    <Box
      className="flex flex-wrap gap-2 pb-2 animate-fade-in"
    >
      {attachments.map((att) => (
        <Box
          key={att.id}
          className="relative flex size-16 overflow-hidden rounded-xl border border-border/60 bg-muted animate-popover"
        >
          {att.type.startsWith("image/") ? (
            <img
              src={att.previewUrl ?? createDataUrl(att.type, att.content || "")}
              alt={att.name}
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
              }}
            />
          ) : (
            <Paperclip size={24} style={{ color: "text.secondary" }} />
          )}
          <IconButton
            size="small"
            onClick={() => onRemove(att.id)}
            aria-label={`Remove attachment ${att.name}`}
            className="absolute right-1 top-1 size-5 rounded-full bg-background/80 text-foreground shadow-sm hover:bg-background"
          >
            <X size={12} />
          </IconButton>
        </Box>
      ))}
    </Box>
  );
});
