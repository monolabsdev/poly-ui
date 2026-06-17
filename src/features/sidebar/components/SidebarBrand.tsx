import * as React from "react";
import { Box, Typography } from "@mui/material";
import { useNotify } from "@/hooks/useNotify";
import { useDevStore } from "@/store/devStore";
import { useSidebar } from "@/features/sidebar/hooks/useSidebar";
import { useReducedMotion } from "@/features/sidebar/hooks/useReducedMotion";
import { SidebarTrigger } from "@/features/sidebar/components/SidebarPrimitives";

export function SidebarBrand() {
  const { isCollapsed } = useSidebar();
  const reducedMotion = useReducedMotion();
  const notify = useNotify();
  const setDevMode = useDevStore((s) => s.actions.setDevMode);
  const devTapCount = React.useRef(0);

  const handleDevTap = () => {
    devTapCount.current += 1;
    if (devTapCount.current >= 10) {
      devTapCount.current = 0;
      setDevMode(true);
      notify.success(
        "Dev mode activated",
        "Tap the PolyUI logo 10 more times to deactivate.",
      );
    } else if (devTapCount.current === 1 && useDevStore.getState().devMode) {
      devTapCount.current = 0;
      setDevMode(false);
      notify.info("Dev mode deactivated");
    }
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: isCollapsed ? "center" : "space-between",
        width: "100%",
        px: isCollapsed ? 0 : 2,
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          opacity: isCollapsed ? 0 : 1,
          width: isCollapsed ? 0 : "auto",
          overflow: "hidden",
          transition: reducedMotion ? "none" : "opacity 0.18s ease",
          pointerEvents: isCollapsed ? "none" : "auto",
        }}
      >
        <Typography
          variant="subtitle2"
          onClick={handleDevTap}
          sx={{
            fontWeight: 600,
            color: "primary.main",
            letterSpacing: "-0.02em",
            fontSize: "14px",
            whiteSpace: "nowrap",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          PolyUI
        </Typography>
      </Box>
      <SidebarTrigger />
    </Box>
  );
}
