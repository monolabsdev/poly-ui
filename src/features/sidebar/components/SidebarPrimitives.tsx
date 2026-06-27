import * as React from "react";
import { Box, IconButton, CSSObject, Typography, Tooltip, ButtonBase, type SxProps } from "@mui/material";
import { alpha, type Theme } from "@mui/material/styles";
import { PanelLeft } from "lucide-react";
import { useSidebar } from "@/features/sidebar/hooks/useSidebar";
import { useReducedMotion } from "@/features/sidebar/hooks/useReducedMotion";

const SIDEBAR_ITEM_SPACING = 4.5;
const SIDEBAR_ICON_SPACING = 4.5;
const SIDEBAR_GLYPH_SPACING = 2;

const sidebarItemFocus = {
  outline: "2px solid",
  outlineColor: "primary.main",
  outlineOffset: "2px",
} as const;

export function sidebarIconGlyphSx(theme: Theme) {
  return {
    width: theme.spacing(2.5),
    height: theme.spacing(2.5),
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    "& > svg": {
      width: theme.spacing(SIDEBAR_GLYPH_SPACING),
      height: theme.spacing(SIDEBAR_GLYPH_SPACING),
    },
  };
}

export function sidebarIconButtonSx(theme: Theme, reducedMotion = false) {
  return {
    ...sidebarIconGlyphSx(theme),
    width: theme.spacing(SIDEBAR_ICON_SPACING),
    height: theme.spacing(SIDEBAR_ICON_SPACING),
    minWidth: theme.spacing(SIDEBAR_ICON_SPACING),
    p: 0,
    color: "text.secondary",
    bgcolor: "transparent",
    transition: reducedMotion
      ? "none"
      : theme.transitions.create(["background-color", "color"]),
    "&:hover": {
      bgcolor: "action.hover",
      color: "text.primary",
    },
    "&:active": {
      bgcolor: "action.selected",
    },
  };
}

export function SidebarHeader({
  children,
  sx,
}: {
  children: React.ReactNode;
  sx?: CSSObject;
}) {
  const { isCollapsed } = useSidebar();
  return (
    <Box
      sx={(theme) => ({
        px: isCollapsed ? 0 : 1.5,
        display: "flex",
        alignItems: "center",
        minHeight: theme.spacing(6),
        ...sx,
      })}
    >
      {children}
    </Box>
  );
}

export function SidebarContent({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={(theme) => ({
        flex: 1,
        overflowY: "auto",
        overflowX: "hidden",
        display: "flex",
        flexDirection: "column",
        scrollbarWidth: "thin",
        scrollbarColor: `${alpha(
          theme.palette.text.primary,
          theme.palette.action.activatedOpacity,
        )} transparent`,
      })}
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
      sx={(theme) => ({
        p: isCollapsed ? 1 : 1.25,
        display: "flex",
        flexDirection: "column",
        gap: 0.75,
        borderTop: "1px solid",
        borderColor: "divider",
        transition: reducedMotion
          ? "none"
          : theme.transitions.create("padding"),
        ...sx,
      })}
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
  return <Box sx={{ mb: 1, width: "100%", ...sx }}>{children}</Box>;
}

export function SidebarGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ pl: 3, pr: 1.5, mb: 0.5, mt: 1.75 }}>
      <Box
        component="span"
        sx={(theme) => ({
          ...theme.typography.overline,
          fontWeight: theme.typography.fontWeightMedium,
          color: "text.secondary",
          opacity: 0.7,
        })}
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
      sx={(theme) => ({
        ...theme.typography.overline,
        fontWeight: theme.typography.fontWeightMedium,
        color: "text.secondary",
        lineHeight: 1.2,
        display: "block",
        textAlign: "left",
      })}
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
        gap: 0.25,
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
  const reducedMotion = useReducedMotion();
  return (
    <Box sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
      <Tooltip title={label} placement="right">
        <IconButton
          aria-label={label}
          onClick={onClick}
          size="small"
          sx={(theme) => sidebarIconButtonSx(theme, reducedMotion)}
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
  sx?: SxProps<Theme>;
  tooltip?: string;
  ariaCurrent?: boolean;
}) {
  const { isCollapsed } = useSidebar();
  const reducedMotion = useReducedMotion();

  const content = (
    <ButtonBase
      onClick={onClick}
      aria-current={ariaCurrent ? "page" : undefined}
      sx={[
        (theme) => ({
          ...theme.typography.body2,
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "flex-start",
          textAlign: "left",
          gap: isCollapsed ? 0 : 1.5,
          px: isCollapsed ? 0 : 1.5,
          width: isCollapsed ? theme.spacing(SIDEBAR_ICON_SPACING) : "100%",
          minWidth: isCollapsed ? theme.spacing(SIDEBAR_ICON_SPACING) : 0,
          maxWidth: isCollapsed ? theme.spacing(SIDEBAR_ICON_SPACING) : "100%",
          height: theme.spacing(SIDEBAR_ITEM_SPACING),
          borderRadius: isCollapsed ? theme.app.radius.pill : theme.shape.borderRadius,
          bgcolor: isActive
            ? alpha(theme.palette.primary.main, theme.palette.action.selectedOpacity)
            : "transparent",
          color: isActive ? "text.primary" : "text.secondary",
          fontWeight: isActive
            ? theme.typography.fontWeightMedium
            : theme.typography.fontWeightRegular,
          overflow: "hidden",
          position: "relative",
          transition: reducedMotion
            ? "none"
            : theme.transitions.create(["background-color", "color"]),
          "&:hover": {
            bgcolor: "action.hover",
            color: "text.primary",
          },
          "&:focus-visible": {
            ...sidebarItemFocus,
          },
          ...(isCollapsed ? { alignSelf: "center" } : {}),
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
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
  const reducedMotion = useReducedMotion();

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
        sx={(theme) => ({
          ...sidebarIconButtonSx(theme, reducedMotion),
          ...sx,
        })}
      >
        <PanelLeft />
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

export function SidebarActionButton({
  icon,
  children,
  onClick,
  shortcut,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
  onClick?: () => void;
  shortcut?: string;
}) {
  const { isCollapsed } = useSidebar();
  const reducedMotion = useReducedMotion();

  const button = (
    <ButtonBase
      onClick={onClick}
      sx={(theme) => ({
        ...theme.typography.button,
        display: "flex",
        alignItems: "center",
        justifyContent: isCollapsed ? "center" : "flex-start",
        gap: isCollapsed ? 0 : 1.5,
        width: isCollapsed ? theme.spacing(SIDEBAR_ICON_SPACING) : "100%",
        height: theme.spacing(SIDEBAR_ITEM_SPACING),
        px: isCollapsed ? 0 : 1.5,
        borderRadius: isCollapsed ? theme.app.radius.pill : theme.shape.borderRadius,
        bgcolor: "transparent",
        border: "none",
        color: "text.secondary",
        fontWeight: theme.typography.fontWeightMedium,
        overflow: "hidden",
        flexShrink: 0,
        transition: reducedMotion
          ? "none"
          : theme.transitions.create(
              ["background-color", "color", "width", "border-radius"],
            ),
        "&:hover": {
          bgcolor: "action.hover",
          color: "text.primary",
        },
        "&:focus-visible": {
          ...sidebarItemFocus,
        },
      })}
    >
      <Box
        sx={(theme) => sidebarIconGlyphSx(theme)}
      >
        {icon}
      </Box>
      <Box
        component="span"
        sx={{
          flex: 1,
          textAlign: "left",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          maxWidth: isCollapsed ? 0 : "none",
          opacity: isCollapsed ? 0 : 1,
        }}
      >
        {children}
      </Box>
      {shortcut && (
        <Typography
          sx={(theme) => ({
            ...theme.typography.caption,
            opacity: 0.5,
            whiteSpace: "nowrap",
            flexShrink: 0,
            maxWidth: isCollapsed ? 0 : "none",
            overflow: "hidden",
          })}
        >
          {shortcut}
        </Typography>
      )}
    </ButtonBase>
  );

  if (isCollapsed) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
        <Tooltip title={children} placement="right">
          {button}
        </Tooltip>
      </Box>
    );
  }

  return button;
}

export function SidebarSectionHeader({
  label,
  action,
}: {
  label: string;
  action?: React.ReactNode;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: (theme) => theme.spacing(3.5),
      }}
    >
      <Typography
        sx={(theme) => ({
          ...theme.typography.overline,
          fontWeight: theme.typography.fontWeightMedium,
          color: "text.secondary",
          lineHeight: 1.2,
        })}
      >
        {label}
      </Typography>
      {action}
    </Box>
  );
}

export { SIDEBAR_ITEM_SPACING as ITEM_HEIGHT };
