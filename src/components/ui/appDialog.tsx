// Design: Quiet instrument panel — fixed-width shell, soft contrast, precise spacing.
import { Modal } from "@/components/ui/modal";
import { Box, IconButton, Typography, useTheme } from "@mui/material";
import type { SxProps, Theme } from "@mui/material";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export const APP_DIALOG_WIDTH = 920;
export const APP_DIALOG_CONTENT_WIDTH = 600;
export const APP_DIALOG_SIDEBAR_WIDTH = 244;

type AppDialogFrameProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export function AppDialogFrame({
  open,
  onOpenChange,
  children,
}: AppDialogFrameProps) {
  const theme = useTheme();

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      maxWidth={APP_DIALOG_WIDTH}
      showCloseButton={false}
      contentSx={{ p: 0 }}
      sx={{
        width: {
          xs: "100vw",
          sm: `min(${APP_DIALOG_WIDTH}px, calc(100vw - 32px))`,
        },
        height: {
          xs: "100dvh",
          sm: "min(680px, calc(100dvh - 48px))",
        },
        maxHeight: {
          xs: "100dvh",
          sm: "min(680px, calc(100dvh - 48px))",
        },
        borderRadius: { xs: 0, sm: "12px" },
        bgcolor: "background.paper",
        borderColor: "border.main",
        boxShadow:
          theme.palette.mode === "dark"
            ? "0 24px 72px rgba(0,0,0,0.54)"
            : "0 24px 72px rgba(15,23,42,0.14)",
        outline: "none",
        mx: { xs: 0, sm: "auto" },
      }}
    >
      {children}
    </Modal>
  );
}

type AppDialogHeaderProps = {
  id?: string;
  title: string;
  onClose: () => void;
  closeSx?: SxProps<Theme>;
};

export function AppDialogHeader({
  id,
  title,
  onClose,
  closeSx,
}: AppDialogHeaderProps) {
  return (
    <Box
      component="header"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: 56,
        px: { xs: 2, md: 3 },
        flexShrink: 0,
      }}
    >
      <Box>
        <Typography id={id} sx={{ fontSize: 16, fontWeight: 700, ml: 1 }}>
          {title}
        </Typography>
      </Box>

      <IconButton
        onClick={onClose}
        aria-label="Close dialog"
        sx={{
          width: 32,
          height: 32,
          color: "text.secondary",
          "&:hover": { bgcolor: "action.hover", color: "text.primary" },
          ...closeSx,
        }}
      >
        <X size={20} />
      </IconButton>
    </Box>
  );
}

export function AppDialogBody({ children }: { children: ReactNode }) {
  return (
    <Box
      component="main"
      sx={{
        flex: 1,
        minHeight: 0,
        overflowY: "auto",
        px: { xs: 2, md: 3 },
        py: 2.5,
        display: "flex",
        justifyContent: "center",
      }}
    >
      <Box sx={{ width: "100%", maxWidth: { xs: "100%", sm: APP_DIALOG_CONTENT_WIDTH }, minWidth: 0 }}>
        {children}
      </Box>
    </Box>
  );
}

export const appPanelSx = {
  p: 0,
  borderRadius: "8px",
  bgcolor: "transparent",
  transition: "background 100ms ease",
} as const;

export const appTextFieldSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "8px",
    bgcolor: "transparent",
    fontSize: 13,
    "& fieldset": { border: "none" },
    "&:hover fieldset": { border: "none" },
    "&.Mui-focused fieldset": { border: "none" },
  },
  "& .MuiInputLabel-root": {
    fontSize: 13,
  },
} as const;

export const appFadeInSx = {
  animation: "app-dialog-fade 140ms ease",
  "@keyframes app-dialog-fade": {
    from: { opacity: 0, transform: "translateY(4px)" },
    to: { opacity: 1, transform: "translateY(0)" },
  },
} as const;
