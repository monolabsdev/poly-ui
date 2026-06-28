import React, { useEffect } from "react";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import IconButton from "@mui/material/IconButton";
import { useTheme } from "@mui/material/styles";
import { alpha } from "@mui/material/styles";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X, Loader2 } from "lucide-react";
import { useNotificationStore, type Toast as ToastType } from "@/store/notificationStore";

const typeIcon = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2,
};

const ToastItem = ({ toast }: { toast: ToastType }) => {
  const remove = useNotificationStore((s) => s.actions.remove);
  const theme = useTheme();

  const getColor = () => {
    switch (toast.type) {
      case "success": return theme.palette.success.main;
      case "error": return theme.palette.error.main;
      case "warning": return theme.palette.warning.main;
      default: return theme.palette.text.secondary;
    }
  };

  const Icon = typeIcon[toast.type] || Info;

  useEffect(() => {
    if (toast.duration === Infinity) return;
    const timer = setTimeout(() => remove(toast.id), toast.duration || 3000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, remove]);

  return (
    <Box
      className="animate-toast-in"
      sx={{
        width: { xs: "calc(100vw - 32px)", sm: 380 },
        maxWidth: 380,
        pointerEvents: "auto",
        mb: 1.5,
        p: "14px 16px",
        borderRadius: "12px",
        bgcolor: alpha(theme.palette.background.paper, 0.95),
        backdropFilter: "blur(8px)",
        border: 1,
        borderColor: alpha(getColor(), 0.25),
        boxShadow: theme.shadows[10],
        display: "flex",
        alignItems: "flex-start",
        gap: 1.75,
        position: "relative",
      }}
    >
      <Box sx={{ mt: 0.25, flexShrink: 0, color: getColor(), lineHeight: 0 }}>
        <Icon size={18} />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            color: "text.primary",
            lineHeight: 1.5,
            letterSpacing: "-0.01em",
          }}
        >
          {toast.message}
        </Typography>
        {toast.description && (
          <Typography
            variant="caption"
            sx={{
              color: "text.secondary",
              mt: 0.5,
              display: "block",
              lineHeight: 1.4,
              fontSize: "0.75rem",
            }}
          >
            {toast.description}
          </Typography>
        )}
      </Box>

      <IconButton
        size="small"
        onClick={() => remove(toast.id)}
        sx={{
          color: "text.disabled",
          p: 0.5,
          mt: -0.5,
          mr: -0.5,
          "&:hover": {
            color: "text.primary",
            bgcolor: alpha(theme.palette.action.hover, 0.5),
          },
        }}
      >
        <X size={14} />
      </IconButton>
    </Box>
  );
};

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const toasts = useNotificationStore((s) => s.toasts);

  return (
    <>
      {children}
      <Box
        sx={{
          position: "fixed",
          bottom: { xs: 16, sm: 24 },
          right: { xs: 16, sm: 24 },
          zIndex: 9999,
          display: "flex",
          flexDirection: "column-reverse",
          pointerEvents: "none",
        }}
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </Box>
    </>
  );
};
