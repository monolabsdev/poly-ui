import React, { useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Box, Typography, IconButton } from "@mui/material";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X, Loader2 } from "lucide-react";
import { useNotificationStore, type Toast as ToastType } from "@/store/notificationStore";

const TYPE_STYLES = {
  success: {
    bg: "rgba(2, 44, 34, 0.95)",
    border: "rgba(16, 185, 129, 0.2)",
    icon: <CheckCircle2 size={18} className="text-emerald-400" />,
  },
  error: {
    bg: "rgba(69, 10, 10, 0.95)",
    border: "rgba(239, 68, 68, 0.2)",
    icon: <AlertCircle size={18} className="text-red-400" />,
  },
  warning: {
    bg: "rgba(69, 26, 3, 0.95)",
    border: "rgba(245, 158, 11, 0.2)",
    icon: <AlertTriangle size={18} className="text-amber-400" />,
  },
  info: {
    bg: "rgba(23, 23, 23, 0.95)",
    border: "rgba(255, 255, 255, 0.1)",
    icon: <Info size={18} className="text-zinc-400" />,
  },
  loading: {
    bg: "rgba(9, 9, 11, 0.95)",
    border: "rgba(255, 255, 255, 0.1)",
    icon: <Loader2 size={18} className="animate-spin text-zinc-500" />,
  },
};

const ToastItem = ({ toast }: { toast: ToastType }) => {
  const remove = useNotificationStore((s) => s.actions.remove);
  const style = TYPE_STYLES[toast.type] || TYPE_STYLES.info;

  useEffect(() => {
    if (toast.duration === Infinity) return;
    const timer = setTimeout(() => remove(toast.id), toast.duration || 3000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, remove]);

  return (
    <Box
      component={motion.div}
      layout
      initial={{ opacity: 0, y: 20, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
      sx={{
        width: 380,
        pointerEvents: "auto",
        mb: 1.5,
        p: "14px 16px",
        borderRadius: "12px",
        bgcolor: style.bg,
        backdropFilter: "blur(8px)",
        border: `1px solid ${style.border}`,
        boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.4)",
        display: "flex",
        alignItems: "flex-start",
        gap: 1.75,
        position: "relative",
      }}
    >
      <Box sx={{ mt: 0.25, flexShrink: 0 }}>{style.icon}</Box>
      
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography 
          variant="body2" 
          sx={{ 
            fontWeight: 600, 
            color: "#fff", 
            lineHeight: 1.5,
            letterSpacing: "-0.01em"
          }}
        >
          {toast.message}
        </Typography>
        {toast.description && (
          <Typography 
            variant="caption" 
            sx={{ 
              color: "rgba(255, 255, 255, 0.6)", 
              mt: 0.5, 
              display: "block",
              lineHeight: 1.4,
              fontSize: "0.75rem"
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
          color: "rgba(255, 255, 255, 0.3)",
          p: 0.5,
          mt: -0.5,
          mr: -0.5,
          "&:hover": { 
            color: "#fff", 
            bgcolor: "rgba(255, 255, 255, 0.1)" 
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
          bottom: 24,
          right: 24,
          zIndex: 9999,
          display: "flex",
          flexDirection: "column-reverse",
          pointerEvents: "none",
        }}
      >
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} />
          ))}
        </AnimatePresence>
      </Box>
    </>
  );
};
