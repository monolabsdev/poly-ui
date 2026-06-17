import * as React from "react";
import { Box, IconButton, CSSObject, Typography, Tooltip, ButtonBase } from "@mui/material";
import { PanelLeft } from "lucide-react";
import { useSidebar } from "@/features/sidebar/hooks/useSidebar";
import { useReducedMotion } from "@/features/sidebar/hooks/useReducedMotion";

export function SidebarHeader({
  children,
  sx,
}: {
  children: React.ReactNode;
  sx?: CSSObject;
}) {
  return (
    <Box
      sx={{
        p: 0,
        display: "flex",
        alignItems: "center",
        minHeight: 56,
        borderBottom: "1px solid",
        borderColor: "transparent",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export function SidebarContent({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {children}
    </Box>
  );
}

export function SidebarFooter({
  children,
  sx,
}: {
  children: React.ReactNode;
  sx?: CSSObject;
}) {
  const { isCollapsed } = useSidebar();
  const reducedMotion = useReducedMotion();
  return (
    <Box
      sx={{
        p: isCollapsed ? 1 : 1.25,
        display: "flex",
        flexDirection: "column",
        gap: 0.75,
        transition: reducedMotion ? "none" : "padding 0.2s",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export function SidebarGroup({
  children,
  sx,
}: {
  children: React.ReactNode;
  sx?: CSSObject;
}) {
  return <Box sx={{ mb: 2, width: "100%", ...sx }}>{children}</Box>;
}

export function SidebarGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ pl: 3, pr: 1.5, mb: 0.5, mt: 1.75 }}>
      <Box
        component="span"
        sx={{
          fontSize: "10px",
          fontWeight: 600,
          color: "text.secondary",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          opacity: 0.7,
        }}
      >
        {children}
      </Box>
    </Box>
  );
}

export function SidebarSectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <Typography
      component="span"
      sx={{
        fontSize: "11px",
        fontWeight: 600,
        color: "text.secondary",
        textTransform: "uppercase",
        letterSpacing: "0.1em",
        lineHeight: 1.2,
        display: "block",
        textAlign: "left",
      }}
    >
      {children}
    </Typography>
  );
}

export function SidebarGroupContent({
  children,
  sx,
}: {
  children: React.ReactNode;
  sx?: CSSObject;
}) {
  return <Box sx={{ px: 0, width: "100%", ...sx }}>{children}</Box>;
}

export function SidebarMenu({
  children,
  sx,
}: {
  children: React.ReactNode;
  sx?: CSSObject;
}) {
  const { isCollapsed } = useSidebar();
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        gap: 0.75,
        px: isCollapsed ? 0 : 1.5,
        alignItems: "stretch",
        width: "100%",
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export function SidebarRailIconButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <Box sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
      <Tooltip title={label} placement="right">
        <IconButton
          aria-label={label}
          onClick={onClick}
          size="small"
          sx={{
            width: 36,
            height: 36,
            p: 0,
            display: "grid",
            placeItems: "center",
            color: "text.secondary",
            bgcolor: "transparent",
            transition: "background-color 0.18s ease-in-out",
            "&:hover": {
              bgcolor: "action.hover",
              color: "text.primary",
            },
            "&:active": {
              bgcolor: "action.selected",
            },
          }}
        >
          {icon}
        </IconButton>
      </Tooltip>
    </Box>
  );
}

export function SidebarMenuButton({
  children,
  isActive,
  onClick,
  sx,
  tooltip,
  ariaCurrent,
}: {
  children: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  sx?: CSSObject;
  tooltip?: string;
  ariaCurrent?: boolean;
}) {
  const { isCollapsed } = useSidebar();

  const content = (
    <ButtonBase
      onClick={onClick}
      aria-current={ariaCurrent ? "page" : undefined}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: isCollapsed ? "center" : "flex-start",
        textAlign: "left",
        gap: isCollapsed ? 0 : 1.5,
        px: isCollapsed ? 0 : 1.5,
        width: isCollapsed ? 38 : "100%",
        minWidth: isCollapsed ? 38 : 0,
        maxWidth: isCollapsed ? 38 : "100%",
        height: 38,
        borderRadius: "9999px",
        bgcolor: isActive ? "action.selected" : "transparent",
        color: isActive ? "text.primary" : "text.secondary",
        fontSize: "13px",
        fontWeight: isActive ? 500 : 400,
        overflow: "hidden",
        position: "relative",
        boxShadow: "none",
        "&:hover": {
          bgcolor: isActive ? "action.selected" : "action.hover",
          color: "text.primary",
        },
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: "2px",
        },
        ...sx,
        ...(isCollapsed ? { alignSelf: "center" } : null),
      }}
    >
      {children}
    </ButtonBase>
  );

  if (isCollapsed && tooltip) {
    return (
      <Tooltip title={tooltip} placement="right">
        {content}
      </Tooltip>
    );
  }

  return content;
}

export function SidebarTrigger({ sx }: { sx?: CSSObject }) {
  const { isCollapsed, setIsCollapsed } = useSidebar();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsCollapsed(!isCollapsed);
  };

  return (
    <Tooltip
      title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
      placement="right"
    >
      <IconButton
        aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        onClick={handleClick}
        size="small"
        sx={{
          color: "text.secondary",
          width: 36,
          height: 36,
          bgcolor: "transparent",
          transition: "background-color 0.18s ease-in-out",
          "&:hover": {
            color: "text.primary",
            bgcolor: "action.hover",
          },
          "&:active": {
            bgcolor: "action.selected",
          },
          ...sx,
        }}
      >
        <PanelLeft size={18} />
      </IconButton>
    </Tooltip>
  );
}

export function SidebarInset({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        bgcolor: "background.sidebar",
      }}
    >
      {children}
    </Box>
  );
}
