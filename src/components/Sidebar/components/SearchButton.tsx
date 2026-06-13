import { ButtonBase, Typography } from "@mui/material";
import { Search } from "lucide-react";
import { useSidebar } from "@/components/Sidebar/hooks/useSidebar";
import { SidebarRailIconButton } from "@/components/Sidebar/components/SidebarPrimitives";
import { IS_MAC } from "@/lib/platform";

export function SearchButton({ onClick }: { onClick: () => void }) {
  const { isCollapsed } = useSidebar();
  if (isCollapsed) {
    return (
      <SidebarRailIconButton
        label="Search"
        onClick={onClick}
        icon={<Search size={16} />}
      />
    );
  }
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        px: 1.5,
        height: 38,
        width: "100%",
        borderRadius: "9999px",
        bgcolor: "action.hover",
        color: "text.secondary",
        "&:hover": {
          bgcolor: "action.selected",
          color: "text.primary",
        },
      }}
    >
      <Search size={16} style={{ flexShrink: 0 }} />
      <Typography sx={{ flex: 1, textAlign: "left", fontSize: 13 }}>
        Search
      </Typography>
      <Typography sx={{ fontSize: 12, opacity: 0.6 }}>
        {IS_MAC ? "Cmd+K" : "Ctrl+K"}
      </Typography>
    </ButtonBase>
  );
}
