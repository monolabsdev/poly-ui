import { memo, useEffect } from "react";
import { Box, Typography, useTheme } from "@mui/material";
import { motion } from "motion/react";
import { Ring2 } from "ldrs/react";
import "ldrs/react/Ring2.css";

type StartupLoadingScreenProps = {
  visible?: boolean;
  onExited?: () => void;
};

function StartupLoadingScreen({
  visible = true,
  onExited,
}: StartupLoadingScreenProps) {
  const theme = useTheme();
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
        PolyUI
      </Typography>
      <Ring2
        size="28"
        stroke="5"
        strokeLength="0.25"
        bgOpacity="0.1"
        speed="0.8"
        color={theme.palette.text.primary}
      />
    </Box>
  );
}

export default memo(StartupLoadingScreen);
