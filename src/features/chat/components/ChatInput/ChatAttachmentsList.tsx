import { Paperclip, X } from "lucide-react";
import { memo } from "react";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
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
      className="animate-fade-in"
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 1.5,
        px: 1.5,
        pt: 1,
        pb: 1,
      }}
    >
      {attachments.map((att) => (
        <Box
          key={att.id}
          className="animate-popover"
          sx={{
            position: "relative",
            width: 64,
            height: 64,
            borderRadius: "12px",
            overflow: "hidden",
            border: "1px solid",
            borderColor: "divider",
            bgcolor: "action.hover",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
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
            sx={{
              position: "absolute",
              top: -4,
              right: -4,
              bgcolor: "background.paper",
              boxShadow: 1,
              p: 0.5,
              "&:hover": { bgcolor: "action.selected" },
            }}
          >
            <X size={12} />
          </IconButton>
        </Box>
      ))}
    </Box>
  );
});
