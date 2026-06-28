# Sidebar & Animation Overhaul

## What

Replace the custom sidebar with shadcn sidebar-07 (collapses to icons) and fix the OS reduce-motion override that kills all CSS transitions.

## Problem

### 1. No animations when OS has reduce-motion enabled

The CSS unconditionally kills animations when the OS has `prefers-reduced-motion: reduce`:
```css
@media (prefers-reduced-motion: reduce) {
    :root {
        --dur-fast: 0.01ms;
        --dur-base: 0.01ms;
        --dur-slow: 0.01ms;
    }
}
```

This fires regardless of the app's "Reduce motion" toggle. Every transition using `var(--dur-*)` — sidebar collapse, opacity changes, folder disclosure — becomes instant (0.01ms). The app toggle only adds `html.reduce-motion` which sets the same vars, but the media query already did it first and nothing restores them when the app toggle is OFF but the OS preference is ON.

The `html.reduce-motion` rule also has reduce-motion animation overrides (`.animate-fade-in`, etc. → `animation: none !important`) but these only target custom classes, not `tw-animate-css` utilities. The shadcn sidebar's built-in animations use `tw-animate-css` and are unaffected.

### 2. Sidebar uses layout-triggering `transition-[width]`

The current sidebar collapses via:
```tsx
transition-[width] duration-[var(--dur-base)]
```

CSS `width` transitions trigger layout recalculations on every frame, causing jank. The shadcn sidebar uses a compositor-only approach (`translateX` + gap/width on wrapper), which is GPU-friendly.

### 3. Custom sidebar primitives are duplicated effort

`SidebarPrimitives.tsx` reimplements what `shadcn/ui sidebar` provides: `SidebarHeader`, `SidebarContent`, `SidebarFooter`, `SidebarGroup`, `SidebarMenu`, `SidebarTrigger`, `SidebarInset`. Replacing with the canonical implementation reduces maintenance.

## Solution

### Phase 1: Install shadcn sidebar-07

Run `npx shadcn@latest add sidebar-07 --yes` which creates:
- `src/components/ui/sidebar.tsx` — sidebar component system (Sidebar, SidebarTrigger, SidebarContent, SidebarFooter, SidebarHeader, SidebarGroup, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarGroupLabel, SidebarGroupContent, SidebarInset, SidebarRail, SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem, SidebarMenuAction, useSidebar)
- `src/hooks/use-mobile.ts` — mobile detection hook
- `src/components/ui/breadcrumb.tsx` — breadcrumb (may not use directly)
- `src/components/app-sidebar.tsx` — app sidebar page component
- `src/components/nav-main.tsx` — main nav
- `src/components/nav-projects.tsx` — projects
- `src/components/nav-user.tsx` — user menu
- `src/components/team-switcher.tsx` — team switcher

Overwrites: button, separator, tooltip, input, skeleton, collapsible, dropdown-menu, avatar, sheet.

### Phase 2: Wire app-sidebar to real features

Replace shadcn demo data with real app wiring:

```
AppSidebar
├── SidebarHeader
│   └── Brand + SidebarTrigger (from existing SidebarBrand)
├── SidebarContent
│   ├── NewChat + Search buttons (existing NewChatButton, SearchButton)
│   ├── Folders section (existing FoldersSection)
│   └── ConversationList (existing ConversationList)
└── SidebarFooter
    └── ProfileMenu / GuestFooter (existing)
```

Each section is wrapped in `SidebarGroup`/`SidebarMenu` as needed. The shadcn `SidebarMenuButton` handles collapsed icon mode with tooltips natively — replaces the custom `SidebarRow` logic.

### Phase 3: Rewire App.tsx

- Replace `SidebarProvider` (custom) with shadcn `SidebarProvider`
- Replace `<Sidebar ...>` with `<AppSidebar />`
- Keep `<SidebarInset>` from shadcn
- Wire callbacks (onNewChat, onOpenCommandPalette, etc.) through context or direct props

### Phase 4: Fix OS reduce-motion override

Change the CSS to use `:root:not(.reduce-motion-forced)` for duration vars and override via class in `main.tsx`:

```css
/* Remove the @media (prefers-reduced-motion: reduce) that targets :root */
/* Instead, let main.tsx handle it via matchMedia listener */

html.reduce-motion {
    --dur-fast: 0.01ms;
    --dur-base: 0.01ms;
    --dur-slow: 0.01ms;
}

/* Only when OS says reduce-motion AND user hasn't explicitly overridden */
html.os-reduce-motion:not(.user-reduce-motion-off) {
    --dur-fast: 0.01ms;
    --dur-base: 0.01ms;
    --dur-slow: 0.01ms;
}
```

The app toggle gives the user explicit control, overriding OS preference.

### Phase 5: Remove old sidebar files

After verification, delete:
- `src/features/sidebar/` (full directory)
- `src/features/sidebar/hooks/useSidebar.tsx` (replaced by shadcn's useSidebar)
- `src/features/sidebar/hooks/useReducedMotion.ts` (merge into settingsStore or keep if used outside sidebar)

Keep `useConversationActions`, `useFolderActions`, `useConversationGroups` if they're used by non-sidebar code. Otherwise remove.

## Error states

- Sidebar loading: the existing `ConversationSkeleton` handles loading state inside `ConversationList`
- Sidebar empty: existing empty state ("No chats yet") in `ConversationList`
- Auth loading: existing loading skeletons in `ProfileMenu`
- Mobile: shadcn `useIsMobile` + `Sidebar` overlay behavior (sheet on mobile)

## Not in scope

- Breadcrumb component (sidebar-07 creates it but we won't use it in the first pass)
- TeamSwitcher (irrelevant — single-user chat app)
- NavProjects (irrelevant — no concept of "projects")
