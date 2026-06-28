import * as React from "react";
import Box from "@mui/material/Box";
import ButtonBase from "@mui/material/ButtonBase";
import Typography from "@mui/material/Typography";
import { useTheme } from "@mui/material/styles";
import { Dialog } from "./dialog";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  destructive?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
}: ConfirmDialogProps) {
  const theme = useTheme();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <Box
        sx={{
          width: "min(400px, calc(100vw - 32px))",
          bgcolor: theme.palette.mode === "dark" ? "#1a1a1a" : theme.palette.background.paper,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: theme.app.radius.dialog,
          p: 3,
          display: "flex",
          flexDirection: "column",
          gap: 1.5,
        }}
      >
        <Typography sx={{ fontSize: 17, fontWeight: 500, color: "text.primary", lineHeight: 1.3 }}>
          {title}
        </Typography>

        {description ? (
          <Typography sx={{ fontSize: 13, fontWeight: 400, color: "text.secondary", lineHeight: 1.5 }}>
            {description}
          </Typography>
        ) : null}

        <Box sx={{ display: "flex", gap: 1, mt: 0.5 }}>
          <ButtonBase
            onClick={() => onOpenChange(false)}
            sx={{
              flex: 1,
              height: 36,
              borderRadius: theme.app.radius.pill,
              bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.07)" : "rgba(0,0,0,0.06)",
              color: "text.primary",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "inherit",
              "&:hover": { bgcolor: theme.palette.mode === "dark" ? "rgba(255,255,255,0.11)" : "rgba(0,0,0,0.09)" },
              transition: "background-color 100ms",
            }}
          >
            {cancelLabel}
          </ButtonBase>
          <ButtonBase
            onClick={() => { onConfirm(); onOpenChange(false); }}
            sx={{
              flex: 1,
              height: 36,
              borderRadius: theme.app.radius.pill,
              bgcolor: theme.palette.mode === "dark" ? "#efefef" : "#1a1a1a",
              color: theme.palette.mode === "dark" ? "#1a1a1a" : "#efefef",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "inherit",
              "&:hover": { bgcolor: theme.palette.mode === "dark" ? "#ffffff" : "#000000" },
              transition: "background-color 100ms",
            }}
          >
            {confirmLabel}
          </ButtonBase>
        </Box>
      </Box>
    </Dialog>
  );
}
