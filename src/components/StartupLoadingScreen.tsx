import { memo, useEffect } from "react";
import { Box } from "@mui/material";
import { motion } from "motion/react";

type StartupLoadingScreenProps = {
  visible?: boolean;
  onExited?: () => void;
};

function StartupLoadingScreen({
  visible = true,
  onExited,
}: StartupLoadingScreenProps) {
  // Safety fallback: if motion fails to trigger onAnimationComplete,
  // ensure we still exit after a reasonable delay when visible becomes false.
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
      }}
    />
  );
}

export default memo(StartupLoadingScreen);
