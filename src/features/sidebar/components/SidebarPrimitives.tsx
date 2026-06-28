import * as React from "react";
import { Box, IconButton, CSSObject, Typography, Tooltip, ButtonBase, type SxProps } from "@mui/material";
import { alpha, useTheme, type Theme } from "@mui/material/styles";
import { motion, AnimatePresence } from "motion/react";
import { ChevronRight, PanelLeft } from "lucide-react";
import { useSidebar } from "@/features/sidebar/hooks/useSidebar";
import { useReducedMotion } from "@/features/sidebar/hooks/useReducedMotion";

const SIDEBAR_ITEM_SPACING = 5;
const SIDEBAR_ICON_SPACING = 4;
const SIDEBAR_GLYPH_SPACING = 2.125;

const ROW_HOVER_DURATION = 0.12;

const sidebarItemFocus = {
  outline: "2px solid",
  outlineColor: "primary.main",
  outlineOffset: "2px",
} as const;

export function sidebarIconGlyphSx(theme: Theme) {
  return {
    width: theme.spacing(SIDEBAR_ICON_SPACING),
    height: theme.spacing(SIDEBAR_ICON_SPACING),
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
        px: isCollapsed ? 1 : 1.5,
        display: "flex",
        alignItems: "center",
        minHeight: theme.spacing(6.5),
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
  return (
    <Box
      sx={{
        px: isCollapsed ? 1 : 1.5,
        py: 1.25,
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        gap: 0.5,
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
  return <Box sx={{ mb: 0.5, width: "100%", ...sx }}>{children}</Box>;
}

export function SidebarGroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <Box sx={{ px: 1.5, mb: 0.25, mt: 0.5, minHeight: (theme) => theme.spacing(2.5), display: "flex", alignItems: "center" }}>
      <Box
        component="span"
        sx={(theme) => ({
          ...theme.typography.caption,
          fontWeight: theme.typography.fontWeightRegular,
          color: "text.disabled",
          fontSize: theme.typography.caption.fontSize,
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
        ...theme.typography.caption,
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
        px: isCollapsed ? 0.5 : 1.5,
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

/** Single source-of-truth row for all sidebar items: nav actions, folders, and chats. */
export function SidebarRow({
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
  const theme = useTheme();
  const [hovered, setHovered] = React.useState(false);

  const content = (
    <ButtonBase
      onClick={onClick}
      aria-current={ariaCurrent ? "page" : undefined}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      sx={[
        (t) => ({
          ...t.typography.body2,
          display: "flex",
          alignItems: "center",
          justifyContent: isCollapsed ? "center" : "flex-start",
          textAlign: "left",
          gap: isCollapsed ? 0 : 1.25,
          px: isCollapsed ? 0 : 1,
          width: isCollapsed ? t.spacing(SIDEBAR_ICON_SPACING) : "100%",
          minWidth: isCollapsed ? t.spacing(SIDEBAR_ICON_SPACING) : 0,
          maxWidth: isCollapsed ? t.spacing(SIDEBAR_ICON_SPACING) : "100%",
          height: t.spacing(SIDEBAR_ITEM_SPACING),
          borderRadius: isCollapsed ? t.app.radius.pill : t.app.radius.control,
          bgcolor: "transparent",
          color: isActive ? "text.primary" : "text.secondary",
          fontWeight: isActive
            ? t.typography.fontWeightMedium
            : t.typography.fontWeightRegular,
          overflow: "hidden",
          position: "relative",
          ...(isCollapsed ? { alignSelf: "center" } : {}),
          "&:focus-visible": sidebarItemFocus,
          "&:hover": { color: "text.primary" },
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
    >
      {/* Animated pill background */}
      <AnimatePresence initial={false}>
        {isActive && (
          <motion.span
            key="active"
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, transition: { duration: ROW_HOVER_DURATION } }}
            transition={{ duration: ROW_HOVER_DURATION }}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "inherit",
              background: theme.palette.action.selected,
              zIndex: 0,
              pointerEvents: "none",
            }}
          />
        )}
        {!isActive && hovered && (
          <motion.span
            key="hover"
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: ROW_HOVER_DURATION }}
            style={{
              position: "absolute",
              inset: 0,
              borderRadius: "inherit",
              background: theme.palette.action.hover,
              zIndex: 0,
              pointerEvents: "none",
            }}
          />
        )}
      </AnimatePresence>
      <Box sx={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", width: "100%", gap: "inherit" }}>
        {children}
      </Box>
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

/** @deprecated Use SidebarRow */
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
  return (
    <SidebarRow
      isActive={isActive}
      onClick={onClick}
      sx={sx}
      tooltip={tooltip}
      ariaCurrent={ariaCurrent}
    >
      {children}
    </SidebarRow>
  );
}

/** @deprecated Use SidebarRow */
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

  const row = (
    <SidebarRow onClick={onClick}>
      <Box sx={(t) => sidebarIconGlyphSx(t)}>
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
      {shortcut && !isCollapsed && (
        <Typography
          sx={(t) => ({
            ...t.typography.caption,
            opacity: 0.5,
            whiteSpace: "nowrap",
            flexShrink: 0,
          })}
        >
          {shortcut}
        </Typography>
      )}
    </SidebarRow>
  );

  if (isCollapsed) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
        <Tooltip title={children} placement="right">
          {row}
        </Tooltip>
      </Box>
    );
  }

  return row;
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

export function SidebarSectionHeader({
  label,
  action,
  disclosure,
}: {
  label: string;
  action?: React.ReactNode;
  disclosure?: {
    expanded: boolean;
    onToggle: () => void;
    controlsId: string;
  };
}) {
  const reducedMotion = useReducedMotion();
  const labelSx = (theme: Theme) => ({
    ...theme.typography.overline,
    fontWeight: theme.typography.fontWeightMedium,
    color: "text.secondary",
    lineHeight: 1.2,
  });

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        minHeight: (theme) => theme.spacing(3.5),
      }}
    >
      {disclosure ? (
        <ButtonBase
          aria-expanded={disclosure.expanded}
          aria-controls={disclosure.controlsId}
          onClick={disclosure.onToggle}
          sx={(theme) => ({
            display: "flex",
            alignItems: "center",
            gap: 0.5,
            minWidth: 0,
            height: theme.spacing(3.5),
            pr: 1,
            borderRadius: theme.app.radius.control,
            color: "text.secondary",
            "&:hover": { color: "text.primary" },
            "&:focus-visible": sidebarItemFocus,
          })}
        >
          <Box
            className="disclosure"
            component="span"
            sx={(theme) => ({
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: theme.spacing(2),
              height: theme.spacing(2),
              transition: reducedMotion
                ? "none"
                : theme.transitions.create("transform", {
                    duration: theme.transitions.duration.shorter,
                    easing: theme.transitions.easing.easeOut,
                  }),
              transform: disclosure.expanded ? "rotate(90deg)" : "rotate(0deg)",
              "& > svg": {
                width: theme.spacing(1.75),
                height: theme.spacing(1.75),
              },
            })}
          >
            <ChevronRight />
          </Box>
          <Typography sx={labelSx}>{label}</Typography>
        </ButtonBase>
      ) : (
        <Typography sx={labelSx}>{label}</Typography>
      )}
      {action}
    </Box>
  );
}

export { SIDEBAR_ITEM_SPACING as ITEM_HEIGHT };
