# Sidebar & Animation Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the custom sidebar with shadcn sidebar-07 and fix the OS reduce-motion override that kills all CSS transitions.

**Architecture:** Install shadcn sidebar-07 (creates `src/components/ui/sidebar.tsx` + demo components), rewrite `app-sidebar.tsx` to wire real features (NewChat, Search, Folders, ConversationList, ProfileMenu), update all imports from old sidebar primitives to shadcn, fix App.css reduce-motion handling, remove replaced files.

**Tech Stack:** React 19 + TypeScript + shadcn/ui sidebar component system + tw-animate-css + Tailwind v4

## Global Constraints

- Keep all existing store logic and hooks intact (chatStore, folderStore, authStore, settingsStore, useConversationActions, useFolderActions, useConversationGroups, useReducedMotion)
- The `isCollapsed` → `open` mapping: old `isCollapsed = true` → new `open = false` (state === "collapsed"); old `setIsCollapsed(x)` → new `setOpen(!x)`
- All existing prop interfaces for Sidebar callbacks must be preserved (onNewChat, onOpenCommandPalette, onOpenSettings, onSelectConversation, onDeleteConversation, onRenameConversation)
- Shadcn sidebar uses `data-slot="sidebar-*"` attributes for styling
- `useSidebar` now from `@/components/ui/sidebar` instead of `@/features/sidebar`

---
### Task 1: Install shadcn sidebar-07

**Files:**
- Install: run `npx shadcn@latest add sidebar-07 --yes`
- This creates/overwrites ~17 files

- [ ] **Step 1: Run the install command**

```bash
cd /home/squeegee/Documents/code/poly-ui && npx shadcn@latest add sidebar-07 --yes
```

Expected: 17 files processed. 9 overwrites, 8 new files.

- [ ] **Step 2: Verify sidebar.tsx was created**

```bash
ls -la src/components/ui/sidebar.tsx src/hooks/use-mobile.ts
```

Expected: both files exist.

---
### Task 2: Rewrite app-sidebar.tsx with real features

**Files:**
- Rewrite: `src/components/app-sidebar.tsx`
- Update: `src/components/nav-user.tsx` → wire to ProfileMenu/GuestFooter
- Update: `src/components/nav-main.tsx` → wire to NewChat/Search buttons
- Delete: `src/components/nav-projects.tsx` (unused)
- Delete: `src/components/team-switcher.tsx` (unused)

**Interfaces:**
- Consumes: `Conversation` from `@/types/chat`, `SettingsTab` from `@/features/settings/SettingsModal`, all store hooks (chatStore, folderStore, authStore)
- Produces: `AppSidebar` component with full props interface for App.tsx

- [ ] **Step 1: Save existing button.tsx (backup)**

```bash
cp src/components/ui/button.tsx src/components/ui/button.tsx.bak
```

After shadcn overwrite, the button loses custom variants. We need to re-add them since the project uses `fullWidth`, `startIcon`, `endIcon`, variants `contained`/`outlined`/`text`, and sizes `small`/`medium`/`icon-xs`/`icon-sm`/`icon-lg` across the codebase.

- [ ] **Step 2: Restore custom button variants**

Read the backup and re-add the missing props/variants to the overwritten `src/components/ui/button.tsx`:

The shadcn version removed:
- Variants: `contained`, `outlined`, `text`
- Sizes: `small`, `medium`, `icon-xs`, `icon-sm`, `icon-lg`
- Props: `fullWidth`, `startIcon`, `endIcon`, `disableElevation`, `disableRipple`, `color`
- The closing `</Comp>` tag instead of self-closing `<Comp />` (needed for children)

Restore these by re-adding the variant/size entries and the optional props.

- [ ] **Step 3: Rewrite nav-main.tsx**

Rewrite `src/components/nav-main.tsx` to expose NewChat + Search buttons:

```tsx
"use client"

import { SquarePen, Search } from "lucide-react"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { fmtShortcut, MOD_KEY } from "@/lib/platform"

export function NavMain({
  onNewChat,
  onSearch,
}: {
  onNewChat: () => void
  onSearch: () => void
}) {
  return (
    <SidebarGroup>
      <SidebarGroupContent>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onNewChat} tooltip="New Chat">
              <SquarePen />
              <span>New Chat</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={onSearch} tooltip="Search">
              <Search />
              <span>Search</span>
              <kbd className="ml-auto pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-sidebar-accent px-1.5 font-mono text-[10px] font-medium text-sidebar-accent-foreground opacity-100">
                {fmtShortcut(MOD_KEY, "K")}
              </kbd>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
```

- [ ] **Step 4: Rewrite nav-user.tsx**

Rewrite `src/components/nav-user.tsx` to render existing ProfileMenu/GuestFooter:

```tsx
"use client"

import * as React from "react"
import { useAuthStore } from "@/store/authStore"
import { ProfileMenu } from "@/features/profile/ProfileMenu"
import { GuestFooter } from "@/features/sidebar/components/GuestFooter"
import type { SettingsTab } from "@/features/settings/SettingsModal"

export function NavUser({
  onOpenSettings,
}: {
  onOpenSettings?: (tab?: SettingsTab) => void
}) {
  const isGuest = useAuthStore((s) => s.isGuest)

  if (isGuest) {
    return <GuestFooter onOpenSettings={onOpenSettings!} />
  }

  return <ProfileMenu onOpenSettings={onOpenSettings} />
}
```

- [ ] **Step 5: Rewrite app-sidebar.tsx**

Replace the demo content with real app wiring:

```tsx
"use client"

import * as React from "react"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { SidebarBrand } from "@/features/sidebar/components/SidebarBrand"
import { FoldersSection } from "@/features/sidebar/components/FoldersSection"
import { ConversationList } from "@/features/sidebar/components/ConversationList"
import { DeleteConversationDialog } from "@/features/chat/components/DeleteConversationDialog"
import { CreateFolderDialog } from "@/features/sidebar/components/CreateFolderDialog"
import { useSidebarActions, SidebarActionsProvider } from "@/features/sidebar/hooks/useSidebarActions"
import { useConversationGroups } from "@/features/sidebar/hooks/useConversationGroups"
import { useFolderStore } from "@/store/folderStore"
import { useChatStore } from "@/store/chatStore"
import type { Conversation } from "@/types/chat"
import type { SettingsTab } from "@/features/settings/SettingsModal"

interface AppSidebarProps extends React.ComponentProps<typeof Sidebar> {
  onOpenSettings: (tab?: SettingsTab) => void
  onOpenCommandPalette: () => void
  onNewChat: () => void
  onSelectConversation: (id: string) => void
  onDeleteConversation: (id: string) => Promise<void>
  onRenameConversation: (id: string, newTitle: string) => Promise<void>
  conversations: Conversation[]
  activeConversationId: string | null
}

function AppSidebarContent({
  onOpenSettings,
  onOpenCommandPalette,
  onNewChat,
  conversations,
}: Pick<AppSidebarProps, "onOpenSettings" | "onOpenCommandPalette" | "onNewChat" | "conversations">) {
  const conversationsLoading = useChatStore((s) => s.conversationsLoading)
  const streamingConversationId = useChatStore((s) => s.streamingConversationId)
  const loadFolders = useFolderStore((s) => s.actions.loadFolders)
  const { conv, folder } = useSidebarActions()
  const groupedConversations = useConversationGroups(conversations)
  const folderConversations = React.useMemo(
    () => conversations.filter((c) => c.folderId && !c.isArchived && !c.isTemporary),
    [conversations],
  )

  React.useEffect(() => {
    loadFolders()
  }, [loadFolders])

  return (
    <>
      <SidebarHeader>
        <SidebarBrand />
      </SidebarHeader>

      <SidebarContent>
        <NavMain onNewChat={onNewChat} onSearch={onOpenCommandPalette} />

        <FoldersSection
          folderConversations={folderConversations}
          streamingConversationId={streamingConversationId}
        />

        <ConversationList
          groupedConversations={groupedConversations}
          conversationsLoading={conversationsLoading}
          streamingConversationId={streamingConversationId}
        />
      </SidebarContent>

      <SidebarFooter>
        <NavUser onOpenSettings={onOpenSettings} />
      </SidebarFooter>

      <DeleteConversationDialog
        open={conv.isDeleteDialogOpen}
        onOpenChange={conv.setIsDeleteDialogOpen}
        onConfirm={conv.handleConfirmDelete}
        title={conv.deleteTitle}
      />

      <CreateFolderDialog folder={folder} />
    </>
  )
}

export function AppSidebar({
  onOpenSettings,
  onOpenCommandPalette,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  conversations,
  activeConversationId,
  ...props
}: AppSidebarProps) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarActionsProvider
        conversations={conversations}
        onDeleteConversation={onDeleteConversation}
        onRenameConversation={onRenameConversation}
        onSelectConversation={onSelectConversation}
      >
        <AppSidebarContent
          onOpenSettings={onOpenSettings}
          onOpenCommandPalette={onOpenCommandPalette}
          onNewChat={onNewChat}
          conversations={conversations}
        />
      </SidebarActionsProvider>
      <SidebarRail />
    </Sidebar>
  )
}
```

- [ ] **Step 6: Delete unused shadcn demo files**

```bash
rm src/components/nav-projects.tsx src/components/team-switcher.tsx
```

---
### Task 3: Update existing sidebar components to use shadcn primitives

**Files:**
- Modify: `src/features/sidebar/components/ConversationList.tsx` — update imports
- Modify: `src/features/sidebar/components/FoldersSection.tsx` — update imports
- Modify: `src/features/sidebar/components/FolderTree.tsx` — update imports
- Modify: `src/features/sidebar/components/ConversationSkeleton.tsx` — update imports
- Modify: `src/features/sidebar/components/GuestFooter.tsx` — update imports
- Modify: `src/features/sidebar/components/SidebarBrand.tsx` — update imports
- Modify: `src/features/profile/ProfileMenu.tsx` — update imports
- Modify: `src/features/chat/components/ConversationItem.tsx` — update imports

**Mapping:**
- Old `useSidebar` from `@/features/sidebar/hooks/useSidebar` → new `useSidebar` from `@/components/ui/sidebar`
- Old `SidebarGroup`, `SidebarGroupLabel`, `SidebarGroupContent`, `SidebarMenu`, `SidebarMenuButton`, `SidebarTrigger` from `@/features/sidebar/components/SidebarPrimitives` → same names from `@/components/ui/sidebar`
- Old `sidebarIconButtonClassName` from `@/features/sidebar/components/SidebarPrimitives` → inline the class string: `"size-8 min-w-8 rounded-full bg-transparent p-0 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-muted"`
- Old `SidebarSectionHeader` — custom component, needs to be kept. Move its definition from SidebarPrimitives to a standalone component in `@/features/sidebar/components/SidebarSectionHeader.tsx` or inline it.
- Old `SidebarActionButton` — deprecated/inline
- Old `isCollapsed` → `!open` (new useSidebar returns `open` instead of `isCollapsed`)

**ConversationSkeleton.tsx update:**
```tsx
import { useSidebar } from "@/components/ui/sidebar";
// Then replace isCollapsed with !open
const { open } = useSidebar();
const isCollapsed = !open;
```

**ConversationList.tsx import changes:**
Replace:
```tsx
import {
  SidebarGroupLabel,
  SidebarMenuButton,
  SidebarSectionHeader,
} from "@/features/sidebar/components/SidebarPrimitives";
import { ConversationSkeleton } from "@/features/sidebar/components/ConversationSkeleton";
import { useSidebar } from "@/features/sidebar/hooks/useSidebar";
import { useSidebarActions } from "@/features/sidebar/hooks/useSidebarActions";
```
With:
```tsx
import {
  SidebarGroupLabel,
  SidebarMenuButton,
} from "@/components/ui/sidebar";
import { SidebarSectionHeader } from "@/features/sidebar/components/SidebarSectionHeader";
import { ConversationSkeleton } from "@/features/sidebar/components/ConversationSkeleton";
import { useSidebar } from "@/components/ui/sidebar";
import { useSidebarActions } from "@/features/sidebar/hooks/useSidebarActions";
```

**FoldersSection.tsx import changes:**
Replace:
```tsx
import { useReducedMotion } from "@/features/sidebar/hooks/useReducedMotion";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarSectionHeader,
  sidebarIconButtonClassName,
} from "@/features/sidebar/components/SidebarPrimitives";
```
With:
```tsx
import { useReducedMotion } from "@/features/sidebar/hooks/useReducedMotion";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
} from "@/components/ui/sidebar";
import { SidebarSectionHeader } from "@/features/sidebar/components/SidebarSectionHeader";
import { sidebarIconButtonClassName } from "@/features/sidebar/components/SidebarPrimitives"; // still needed
```

**FolderTree.tsx import changes:**
Replace:
```tsx
import {
  SidebarMenuButton,
  sidebarIconButtonClassName,
} from "@/features/sidebar/components/SidebarPrimitives";
import { useSidebar } from "@/features/sidebar/hooks/useSidebar";
import { useSidebarActions } from "@/features/sidebar/hooks/useSidebarActions";
```
With:
```tsx
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { sidebarIconButtonClassName } from "@/features/sidebar/components/SidebarPrimitives";
import { useSidebar } from "@/components/ui/sidebar";
import { useSidebarActions } from "@/features/sidebar/hooks/useSidebarActions";
```
And replace `isCollapsed` usage with `!open`.

**GuestFooter.tsx import changes:**
Replace:
```tsx
import { useSidebar } from "@/features/sidebar/hooks/useSidebar";
import { sidebarIconButtonClassName } from "@/features/sidebar/components/SidebarPrimitives";
```
With:
```tsx
import { useSidebar } from "@/components/ui/sidebar";
import { sidebarIconButtonClassName } from "@/features/sidebar/components/SidebarPrimitives";
```
And replace `isCollapsed` usage with `!open`.

**SidebarBrand.tsx import changes:**
Replace:
```tsx
import { useSidebar } from "@/features/sidebar/hooks/useSidebar";
import { useReducedMotion } from "@/features/sidebar/hooks/useReducedMotion";
import { SidebarTrigger } from "@/features/sidebar/components/SidebarPrimitives";
```
With:
```tsx
import { useSidebar } from "@/components/ui/sidebar";
import { useReducedMotion } from "@/features/sidebar/hooks/useReducedMotion";
import { SidebarTrigger } from "@/components/ui/sidebar";
```
And replace `isCollapsed` usage with `!open`. The shadcn `SidebarTrigger` doesn't accept a className with `sidebarIconButtonClassName` pattern — just use it as-is.

**ProfileMenu.tsx import changes:**
Replace:
```tsx
import { useSidebar } from "@/features/sidebar";
```
With:
```tsx
import { useSidebar } from "@/components/ui/sidebar";
```
And replace `isCollapsed` usage with `!open`.

**ConversationItem.tsx — `useReducedMotion()` is called but return value unused**: Keep the import path to `useReducedMotion` from `@/features/sidebar/hooks/useReducedMotion` (it stays there).

- [ ] **Step 1: Create SidebarSectionHeader.tsx**

This was originally in SidebarPrimitives.tsx. Extract it to its own file at `src/features/sidebar/components/SidebarSectionHeader.tsx`:

```tsx
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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
  return (
    <div className="flex min-h-7 items-center justify-between">
      {disclosure ? (
        <button
          type="button"
          aria-expanded={disclosure.expanded}
          aria-controls={disclosure.controlsId}
          onClick={disclosure.onToggle}
          className="flex h-7 min-w-0 items-center gap-1 rounded-lg pr-2 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span
            className={cn(
              "flex size-4 items-center justify-center transition-transform duration-[var(--dur-base)] ease-[var(--ease-premium)] [&>svg]:size-3.5",
              disclosure.expanded && "rotate-90",
            )}
          >
            <ChevronRight />
          </span>
          <span className="text-xs font-medium uppercase leading-[1.2]">
            {label}
          </span>
        </button>
      ) : (
        <span className="text-xs font-medium uppercase leading-[1.2] text-muted-foreground">
          {label}
        </span>
      )}
      {action}
    </div>
  );
}
```

- [ ] **Step 2: Update ConversationList.tsx imports**

Edit `src/features/sidebar/components/ConversationList.tsx` to import from shadcn sidebar instead of old primitives.

- [ ] **Step 3: Update FoldersSection.tsx imports**

Edit `src/features/sidebar/components/FoldersSection.tsx` — replace old primitives imports with shadcn + SidebarSectionHeader.

- [ ] **Step 4: Update FolderTree.tsx imports**

Edit `src/features/sidebar/components/FolderTree.tsx` — replace `useSidebar` and `SidebarMenuButton` imports.

- [ ] **Step 5: Update ConversationSkeleton.tsx imports**

Edit `src/features/sidebar/components/ConversationSkeleton.tsx` — replace `useSidebar` import.

- [ ] **Step 6: Update GuestFooter.tsx imports**

Edit `src/features/sidebar/components/GuestFooter.tsx` — replace `useSidebar` import.

- [ ] **Step 7: Update SidebarBrand.tsx imports**

Edit `src/features/sidebar/components/SidebarBrand.tsx` — replace `useSidebar` and `SidebarTrigger` imports.

- [ ] **Step 8: Update ProfileMenu.tsx imports**

Edit `src/features/profile/ProfileMenu.tsx` — replace `useSidebar` import.

- [ ] **Step 9: Remove old sidebar index.ts and replace App.tsx wiring**

Delete `src/features/sidebar/index.ts`. Update `src/App.tsx`:

Replace:
```tsx
import { Sidebar, SidebarInset, SidebarProvider } from "@/features/sidebar";
```
With:
```tsx
import { AppSidebar } from "@/components/app-sidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
```

Replace the `<SidebarProvider>` usage: remove the `data-resize-contain` pattern (shadcn handles it). Replace `<Sidebar ...>` with `<AppSidebar ...>`. Remove `collapsible` prop from AppSidebar (it's set inside). Wire all the props.

```tsx
<SidebarProvider>
  <AppSidebar
    onOpenSettings={handleOpenSettings}
    onOpenCommandPalette={handleOpenCommandPalette}
    onNewChat={handleNewChat}
    onSelectConversation={handleSelectConversation}
    onDeleteConversation={handleDeleteConversation}
    onRenameConversation={handleRenameConversation}
    conversations={conversations}
    activeConversationId={activeConversationId}
  />
  <SidebarInset>
    <ChatPanel backgroundImage={activeFolderBackground}>
      ...
    </ChatPanel>
  </SidebarInset>
  ...
</SidebarProvider>
```

- [ ] **Step 10: Build check**

```bash
cd /home/squeegee/Documents/code/poly-ui && bun run build 2>&1 | head -60
```

If errors, fix them before proceeding.

---
### Task 4: Fix CSS reduce-motion override

**Files:**
- Modify: `src/App.css` — replace media query with class-based approach
- Modify: `src/main.tsx` — add OS reduce-motion listener to override app toggle

**Problem:** `@media (prefers-reduced-motion: reduce) { :root { --dur-*: 0.01ms } }` fires unconditionally when OS says reduce motion, making all `var(--dur-*)` transitions instant — even when the app's reduce-motion toggle is OFF.

**Fix:** Remove the `:root` media-query overrides. Instead, use `main.tsx` to detect OS preference and apply a class. The app toggle class always wins.

- [ ] **Step 1: Update App.css**

Replace:
```css
@media (prefers-reduced-motion: reduce) {
    :root {
        --dur-fast: 0.01ms;
        --dur-base: 0.01ms;
        --dur-slow: 0.01ms;
    }
}

html.reduce-motion {
    --dur-fast: 0.01ms;
    --dur-base: 0.01ms;
    --dur-slow: 0.01ms;
}
```
With:
```css
html.reduce-motion,
html.os-reduce-motion {
    --dur-fast: 0.01ms;
    --dur-base: 0.01ms;
    --dur-slow: 0.01ms;
}
```

Also update the animation kill list at the bottom of App.css:
Replace:
```css
@media (prefers-reduced-motion: reduce) {
  .animate-fade-in,
  ...
  .terax-shimmer {
    animation: none !important;
  }
}

html.reduce-motion .animate-fade-in,
... {
  animation: none !important;
}
```
With:
```css
html.reduce-motion .animate-fade-in,
html.reduce-motion .animate-slide-in,
...
html.os-reduce-motion .animate-fade-in,
html.os-reduce-motion .animate-slide-in,
... {
  animation: none !important;
}
```

- [ ] **Step 2: Update main.tsx**

Add OS reduce-motion detection. Import `useEffect` if not already. Add to the Root component:

```tsx
// Near the other useEffect blocks
useEffect(() => {
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  const update = () => {
    document.documentElement.classList.toggle("os-reduce-motion", mql.matches);
  };
  update();
  mql.addEventListener("change", update);
  return () => mql.removeEventListener("change", update);
}, []);
```

But we need to be careful: when the user explicitly toggles `reduceMotion` ON in the app, `html.reduce-motion` is added which sets `--dur-*` to 0.01ms. When the user toggles it OFF, `html.reduce-motion` is removed. But `html.os-reduce-motion` might still be there from OS preference.

The key insight: `html.reduce-motion` and `html.os-reduce-motion` should produce the same effect (no animations). But the app toggle should OVERRIDE the OS preference.

Fix: In `main.tsx`, change the reduce-motion toggle to handle both:

```tsx
useEffect(() => {
  // App toggle: always respected
  document.documentElement.classList.toggle(
    "reduce-motion",
    performance.reduceMotion,
  );
  document.documentElement.classList.toggle(
    "reduce-transparency",
    performance.reduceTransparency,
  );
}, [performance.reduceMotion, performance.reduceTransparency]);

// OS preference: only applies if user hasn't explicitly set app toggle
useEffect(() => {
  const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
  const update = () => {
    // Only apply OS preference if app toggle hasn't been explicitly set
    // If user explicitly toggled it, their choice wins
    const hasExplicitChoice = localStorage.getItem("polyui:settings")?.includes('"reduceMotion"');
    if (!hasExplicitChoice) {
      document.documentElement.classList.toggle("os-reduce-motion", mql.matches);
    }
  };
  update();
  mql.addEventListener("change", update);
  return () => mql.removeEventListener("change", update);
}, []);
```

Wait, this is getting complex. The simpler approach: just use `performance.reduceMotion` to determine everything. The `main.tsx` already sets `html.reduce-motion` based on the app setting. We just need to remove the media query from CSS.

But the issue is: when the user has OS reduce-motion ON and app setting OFF, the media query fires and kills animations. Without the media query, animations work. The OS setting should NOT kill app animations when the app toggle is OFF.

The simplest fix: Remove the `@media (prefers-reduced-motion: reduce)` from CSS entirely. The only way to enable reduce motion is through the app toggle. This gives the user full control.

Actually, looking at the current code flow:
1. `settingsStore.performance.reduceMotion` defaults to `false`
2. In `main.tsx`, `performance.reduceMotion` toggles `html.reduce-motion` class
3. In CSS, `html.reduce-motion` sets `--dur-*` to 0.01ms
4. But `@media (prefers-reduced-motion: reduce)` ALSO sets `--dur-*` to 0.01ms regardless

So even if `reduceMotion` is `false` in the store (user turned it off), if the OS has reduce-motion on, the media query fires and kills everything.

The fix: Remove the media query from CSS. If someone wants reduced motion, they toggle it in the app. Done.

```css
/* REMOVE THIS ENTIRE BLOCK */
@media (prefers-reduced-motion: reduce) {
    :root {
        --dur-fast: 0.01ms;
        --dur-base: 0.01ms;
        --dur-slow: 0.01ms;
    }
}
/* KEEP THIS */
html.reduce-motion {
    --dur-fast: 0.01ms;
    --dur-base: 0.01ms;
    --dur-slow: 0.01ms;
}
```

And remove the animation kill `@media` query too:
```css
/* REMOVE THIS ENTIRE BLOCK */
@media (prefers-reduced-motion: reduce) {
  .animate-fade-in,
  ...
  .terax-shimmer {
    animation: none !important;
  }
}
```

Keep only:
```css
html.reduce-motion .animate-fade-in,
html.reduce-motion .animate-slide-in,
... {
  animation: none !important;
}
```

This is the cleanest approach — the CSS media query should NOT force reduce motion on behalf of the OS. The app toggle is the only control. If the user wants animations even with OS reduce motion on, they can.

- [ ] **Step 3: Build check**

```bash
cd /home/squeegee/Documents/code/poly-ui && bun run build 2>&1 | head -30
```

---
### Task 5: Remove old sidebar files

**Files:**
- Delete: `src/features/sidebar/Sidebar.tsx`
- Delete: `src/features/sidebar/index.ts`
- Delete: `src/features/sidebar/components/SidebarPrimitives.tsx`
- Delete: `src/features/sidebar/hooks/useSidebar.tsx`
- Delete: `src/features/sidebar/hooks/useResizePerformance.ts`
- Delete: `src/features/sidebar/components/NewChatButton.tsx`
- Delete: `src/features/sidebar/components/SearchButton.tsx`
- Delete: `src/components/nav-projects.tsx` (already deleted in Task 2)
- Delete: `src/components/team-switcher.tsx` (already deleted in Task 2)

**Keep:** All remaining sidebar feature files (FoldersSection, FolderTree, ConversationList, ConversationSkeleton, GuestFooter, SidebarBrand, SidebarSectionHeader, CreateFolderDialog, useSidebarActions, useConversationActions, useFolderActions, useConversationGroups, useReducedMotion)

- [ ] **Step 1: Delete the files**

```bash
rm src/features/sidebar/Sidebar.tsx
rm src/features/sidebar/index.ts
rm src/features/sidebar/components/SidebarPrimitives.tsx
rm src/features/sidebar/hooks/useSidebar.tsx
rm src/features/sidebar/hooks/useResizePerformance.ts
rm src/features/sidebar/components/NewChatButton.tsx
rm src/features/sidebar/components/SearchButton.tsx
```

- [ ] **Step 2: Build check**

```bash
cd /home/squeegee/Documents/code/poly-ui && bun run build 2>&1 | head -60
```

Fix any import errors.

---
### Task 6: Verify

- [ ] **Step 1: Run typecheck**

```bash
cd /home/squeegee/Documents/code/poly-ui && npx tsc --noEmit 2>&1 | head -60
```

- [ ] **Step 2: Run tests**

```bash
cd /home/squeegee/Documents/code/poly-ui && bun run test 2>&1 | tail -30
```

- [ ] **Step 3: Run the app**

```bash
cd /home/squeegee/Documents/code/poly-ui && bun run tauri dev
```

Verify:
- Sidebar collapses to icons with smooth animation
- New Chat button works
- Search button opens command palette
- Folders section shows/discloses with animation
- Conversation list renders with virtualization
- Profile menu opens dropdown
- Guest footer shows for guest users
- Mobile sidebar renders as sheet overlay
- Toggle with keyboard shortcut (Cmd+B)
- No regressions in chat workspace
