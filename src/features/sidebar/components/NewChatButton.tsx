import { Box, ButtonBase, Tooltip } from "@mui/material";
import { SquarePen } from "lucide-react";
import { useSidebar } from "@/features/sidebar/hooks/useSidebar";

export function NewChatButton({ onClick }: { onClick: () => void }) {
  const { isCollapsed } = useSidebar();

  return (
    <Tooltip
      title="New Chat"
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
            justifyContent: isCollapsed ? "center" : "flex-start",
            gap: isCollapsed ? 0 : 1.5,
            px: isCollapsed ? 0 : 1.5,
            width: "100%",
            maxWidth: isCollapsed ? 36 : "none",
            height: isCollapsed ? 36 : 38,
            borderRadius: isCollapsed ? "50%" : "9999px",
            bgcolor: isCollapsed ? "transparent" : "background.paper",
            border: isCollapsed ? "none" : "1px solid",
            borderColor: isCollapsed ? "transparent" : "divider",
            overflow: "hidden",
            color: "text.secondary",
            fontSize: "13px",
            fontWeight: 500,
            position: "relative",
            boxShadow: "none",
            "&:hover": {
              bgcolor: "action.hover",
              color: "text.primary",
              ...(!isCollapsed && { borderColor: "border.main" }),
            },
            "&:focus-visible": {
              outline: "2px solid",
              outlineColor: "primary.main",
              outlineOffset: "2px",
            },
          }}
        >
          <SquarePen size={16} style={{ flexShrink: 0 }} />
          <Box
            component="span"
            sx={{
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              maxWidth: isCollapsed ? 0 : 200,
            }}
          >
            New Chat
          </Box>
        </ButtonBase>
      </Box>
    </Tooltip>
  );
}
