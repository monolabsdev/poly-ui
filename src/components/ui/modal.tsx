import * as React from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Typography from "@mui/material/Typography";
import Stack from "@mui/material/Stack";
import { SxProps } from "@mui/material/styles";
import { Theme } from "@mui/material/styles";
import { X } from "lucide-react";

interface ModalProps {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  maxWidth?: number | string;
  height?: number | string;
  showCloseButton?: boolean;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  sx?: SxProps<Theme>;
  contentSx?: SxProps<Theme>;
}

export function Modal({
  children,
  open,
  onOpenChange,
  title,
  description,
  maxWidth = 500,
  height,
  showCloseButton = true,
  headerAction,
  footer,
  sx,
  contentSx,
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        sx={{
          width: typeof maxWidth === "number"
            ? `min(${maxWidth}px, calc(100vw - 32px))`
            : `min(${maxWidth}, calc(100vw - 32px))`,
          maxWidth: maxWidth,
          height: height,
          display: "flex",
          flexDirection: "column",
          maxHeight: "calc(100vh - var(--titlebar-height) - 32px)",
          ...sx as any,
        }}
      >
        {(title || description || showCloseButton || headerAction) && (
          <DialogHeader
            sx={{
              p: 2,
              borderBottom: 1,
              borderColor: "divider",
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
              {title && (
                <DialogTitle>
                  <Typography variant="h6" sx={{ fontWeight: 600, color: "text.primary" }}>
                    {title}
                  </Typography>
                </DialogTitle>
              )}
              {description && (
                <DialogDescription sx={{ p: 0 }}>
                  <Typography variant="body2" sx={{ color: "text.secondary" }}>
                    {description}
                  </Typography>
                </DialogDescription>
              )}
            </Stack>
            
            <Stack direction="row" spacing={1} alignItems="center">
              {headerAction}
              {showCloseButton && (
                <IconButton
                  size="small"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close modal"
                  sx={{ color: "text.secondary", "&:hover": { color: "text.primary" } }}
                >
                  <X size={18} />
                </IconButton>
              )}
            </Stack>
          </DialogHeader>
        )}

        <Box
          sx={{
            flex: 1,
            overflowY: "auto",
            minHeight: 0,
            ...contentSx as any,
          }}
        >
          {children}
        </Box>

        {footer && (
          <Box
            sx={{
              p: 2,
              borderTop: 1,
              borderColor: "divider",
              flexShrink: 0,
            }}
          >
            {footer}
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}
