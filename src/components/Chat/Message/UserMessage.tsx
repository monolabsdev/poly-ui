import { Box, Typography, useTheme } from "@mui/material";
import { Paperclip } from "lucide-react";
import { isImageAttachment, createDataUrl, formatFileSize } from "@/lib/utils";
import type { MessageProps } from "./types";

export function UserMessage({ content, attachments }: MessageProps) {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  return (
    <Box
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
