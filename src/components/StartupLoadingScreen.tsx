import { memo, useEffect } from "react";
import { Box, Typography } from "@mui/material";
import { motion } from "motion/react";

type StartupLoadingScreenProps = {
  visible?: boolean;
  onExited?: () => void;
};

function StartupLoadingScreen({
  visible = true,
  onExited,
}: StartupLoadingScreenProps) {
  useEffect(() => {
    if (visible || !onExited) return;
    const timer = setTimeout(onExited, 1000);
    return () => clearTimeout(timer);
  }, [visible, onExited]);

  return (
    <Box
      component={motion.div}
      initial={false}
      animate={{ opacity: visible ? 1 : 0 }}
      transition={{ duration: 0.28, ease: "easeOut" }}
      onAnimationComplete={() => {
        if (!visible) onExited?.();
      }}
      sx={{
        position: "fixed",
        inset: 0,
        zIndex: 2147483647,
        bgcolor: "background.default",
        pointerEvents: visible ? "auto" : "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
      }}
    >
      <Typography
        sx={{
          fontSize: 28,
          fontWeight: 700,
          letterSpacing: "-0.03em",
          color: "text.primary",
        }}
      >
        Openbench AI
      </Typography>
      <Box
        sx={{
          width: 28,
          height: 28,
          borderRadius: "50%",
          border: "3px solid",
          borderColor: "text.secondary",
          borderTopColor: "text.primary",
          animation: "openbench-spin 0.8s linear infinite",
          "@keyframes openbench-spin": {
            "0%": { transform: "rotate(0deg)" },
            "100%": { transform: "rotate(360deg)" },
          },
        }}
      />
    </Box>
  );
}

export default memo(StartupLoadingScreen);
