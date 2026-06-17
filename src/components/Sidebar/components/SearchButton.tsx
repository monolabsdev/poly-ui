import { Box, ButtonBase, Tooltip, Typography } from "@mui/material";
import { Search } from "lucide-react";
import { useSidebar } from "@/components/Sidebar/hooks/useSidebar";
import { useReducedMotion } from "@/components/Sidebar/hooks/useReducedMotion";
import { IS_MAC } from "@/lib/platform";

export function SearchButton({ onClick }: { onClick: () => void }) {
  const { isCollapsed } = useSidebar();
  const reducedMotion = useReducedMotion();

  const tr = reducedMotion
    ? "none"
    : "max-width 0.18s cubic-bezier(0.2,0.8,0.2,1), gap 0.18s cubic-bezier(0.2,0.8,0.2,1), border-radius 0.18s cubic-bezier(0.2,0.8,0.2,1)";

  return (
    <Tooltip
      title="Search"
      placement="right"
      disableHoverListener={!isCollapsed}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: isCollapsed ? "center" : "flex-start",
          width: "100%",
        }}
      >
        <ButtonBase
          onClick={onClick}
          sx={{
            display: "flex",
            alignItems: "center",
            gap: isCollapsed ? 0 : 1.5,
            width: "100%",
            maxWidth: isCollapsed ? 36 : "none",
            height: isCollapsed ? 36 : 38,
            borderRadius: isCollapsed ? "50%" : "9999px",
            bgcolor: "action.hover",
            color: "text.secondary",
            overflow: "hidden",
            transition: tr,
            "&:hover": {
              bgcolor: "action.selected",
              color: "text.primary",
            },
            "&:focus-visible": {
              outline: "2px solid",
              outlineColor: "primary.main",
              outlineOffset: "2px",
            },
          }}
        >
          <Box
            sx={{
              flexGrow: isCollapsed ? 1 : 0,
              flexShrink: 1,
              flexBasis: 0,
            }}
          />
          <Search size={16} style={{ flexShrink: 0 }} />
          <Typography
            sx={{
              flexGrow: isCollapsed ? 0 : 1,
              flexShrink: 1,
              flexBasis: "auto",
              textAlign: "left",
              fontSize: 13,
              overflow: "hidden",
              whiteSpace: "nowrap",
              maxWidth: isCollapsed ? 0 : "none",
            }}
          >
            Search
          </Typography>
          <Typography
            sx={{
              fontSize: 12,
              opacity: 0.6,
              overflow: "hidden",
              whiteSpace: "nowrap",
              maxWidth: isCollapsed ? 0 : "none",
            }}
          >
            {IS_MAC ? "Cmd+K" : "Ctrl+K"}
          </Typography>
          <Box
            sx={{
              flexGrow: isCollapsed ? 1 : 0,
              flexShrink: 1,
              flexBasis: 0,
            }}
          />
        </ButtonBase>
      </Box>
    </Tooltip>
  );
}
