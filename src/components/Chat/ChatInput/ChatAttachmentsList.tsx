import { Paperclip, X } from "lucide-react";
import { memo } from "react";
import { Box, IconButton } from "@mui/material";
import { motion, AnimatePresence } from "motion/react";
import { useTiming } from "@/lib/motion";
import { Attachment } from "@/types/chat";
import { createDataUrl } from "@/lib/utils";

interface ChatAttachmentsListProps {
  attachments: Attachment[];
  onRemove: (id: string) => void;
}

export const ChatAttachmentsList = memo(function ChatAttachmentsList({
  attachments,
  onRemove,
}: ChatAttachmentsListProps) {
  const timing = useTiming();

  if (attachments.length === 0) return null;

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, height: 0, overflow: "hidden" }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: timing.duration("base"), ease: timing.ease }}
      sx={{
        display: "flex",
        flexWrap: "wrap",
        gap: 1.5,
        px: 1.5,
        pt: 1,
        pb: 1,
      }}
    >
      <AnimatePresence>
        {attachments.map((att) => (
          <Box
            component={motion.div}
            layout
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: timing.duration("fast"), ease: timing.ease }}
            key={att.id}
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
                src={createDataUrl(att.type, att.content || "")}
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
      </AnimatePresence>
    </Box>
  );
});
