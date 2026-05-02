import { memo } from "react";
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
