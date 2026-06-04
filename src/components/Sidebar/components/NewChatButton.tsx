import { Box } from "@mui/material";
import { SquarePen } from "lucide-react";
import { useSidebar } from "@/components/Sidebar/hooks/useSidebar";
import { useReducedMotion } from "@/components/Sidebar/hooks/useReducedMotion";
import {
  SidebarMenuButton,
  SidebarRailIconButton,
} from "@/components/Sidebar/components/SidebarPrimitives";

export function NewChatButton({ onClick }: { onClick: () => void }) {
  const { isCollapsed } = useSidebar();
  const reducedMotion = useReducedMotion();
  if (isCollapsed) {
    return (
      <SidebarRailIconButton
        label="New Chat"
        onClick={onClick}
        icon={<SquarePen size={16} />}
      />
    );
  }
  return (
    <SidebarMenuButton
      onClick={onClick}
      isActive={false}
      tooltip="New Chat"
      sx={{
        height: 38,
        width: "100%",
        bgcolor: "background.paper",
        border: "1px solid",
        borderColor: "divider",
        "&:hover": {
          bgcolor: "action.hover",
          borderColor: "border.main",
        },
      }}
    >
      <SquarePen size={16} />
      <Box
        component="span"
        sx={{
          fontWeight: 500,
          whiteSpace: "nowrap",
          overflow: "hidden",
          transition: reducedMotion ? "none" : "opacity 0.18s ease",
        }}
      >
        New Chat
      </Box>
    </SidebarMenuButton>
  );
}
