import type * as React from "react"

/**
 * Single source of truth for sidebar sizing, spacing and radius.
 * Consumed both as JS values and (via `sidebarStyleVars`) as CSS variables,
 * so expanded and collapsed modes stay in lockstep. Don't hardcode these
 * numbers in components — reference the CSS vars (e.g. `h-(--sidebar-item-height)`).
 */
export const SIDEBAR_TOKENS = {
  expandedWidth: "17rem", // ~272px, within the 260–280px target
  collapsedWidth: "4rem", // 64px
  mobileWidth: "18rem",
  sidebarPadding: "0.625rem", // 10px
  itemHeight: "2.5rem", // 40px nav/folder/chat rows
  iconButtonSize: "2.25rem", // 36px collapsed icon hitbox
  iconSize: "1.125rem", // 18px
  itemRadius: "var(--radius-lg)",
  panelRadius: "var(--radius-4xl)",
  sectionGap: "0.5rem", // 8px between sidebar sections
} as const

export const sidebarStyleVars = {
  "--sidebar-width": SIDEBAR_TOKENS.expandedWidth,
  "--sidebar-width-icon": SIDEBAR_TOKENS.collapsedWidth,
  "--sidebar-padding": SIDEBAR_TOKENS.sidebarPadding,
  "--sidebar-item-height": SIDEBAR_TOKENS.itemHeight,
  "--sidebar-icon-button": SIDEBAR_TOKENS.iconButtonSize,
  "--sidebar-icon-size": SIDEBAR_TOKENS.iconSize,
  "--sidebar-item-radius": SIDEBAR_TOKENS.itemRadius,
  "--sidebar-panel-radius": SIDEBAR_TOKENS.panelRadius,
  "--sidebar-section-gap": SIDEBAR_TOKENS.sectionGap,
} as React.CSSProperties
