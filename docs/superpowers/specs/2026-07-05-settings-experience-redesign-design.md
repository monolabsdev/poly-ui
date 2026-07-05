# Settings Experience Redesign

## Goal

Replace the current settings modal with a polished shadcn/ui + Tailwind settings experience while preserving every existing store-backed behavior.

## Current shape

- `src/features/settings/SettingsModal.tsx` owns the modal shell, tab list, lazy-ish visited tab rendering, and developer tab.
- Settings tabs live under `src/features/settings/tabs/`.
- Shared row wrappers live in `src/features/settings/SettingComponents.tsx`.
- Persistent settings are in `src/store/settingsStore.ts`, `src/store/themeStore.ts`, `src/store/modelStore.ts`, auth/profile stores, provider store, memory APIs, and agent/dev stores.
- Full-height custom app views already use `src/lib/view-registry.ts`; `ChatWorkspace` swaps chat content for registered views without touching chat state.

## Approach

Use the existing shadcn components already installed in the repo. Do not add dependencies. Rebuild the settings shell and shared setting primitives, then adapt existing tab content into the new row system. Keep behavior in current stores and action handlers.

This keeps the change broad enough to fix the whole settings experience, but avoids a config-driven rewrite that would duplicate store logic.

## Modal layout

Create these focused components under `src/features/settings/`:

- `SettingsDialog`: large centered dialog, 1100-1280px max width, 80-88vh height, responsive fallback for narrow desktop windows.
- `SettingsSidebar`: title, search input, normal tab nav, pinned Advanced action at bottom.
- `SettingsSearch`: shadcn `InputGroup` with search icon and clear affordance.
- `SettingsNavItem`: accessible button with icon, active state, and keyboard focus.
- `SettingsPanel`: tab title, optional description, scrollable content area, optional footer.
- `SettingsSection`: section heading and description.
- `SettingRow`: label, description, right-aligned control, and responsive stacked layout for complex controls.
- `SettingControlGroup`: compact wrappers for groups of related buttons/inputs.

Use semantic tokens only: `bg-background`, `bg-card`, `bg-muted`, `text-muted-foreground`, `border-border`, `bg-accent`, `text-primary`, and existing CSS variables. No raw hex/rgb colors.

## Tabs

Build the visible tabs from real settings currently backed by stores or existing components:

- General: theme, language, notifications.
- Interface: empty-state model label, motion, transparency, app scale.
- Providers: provider connections and web search settings.
- Models: default/selected model controls only if existing model settings can be exposed without changing chat model logic; otherwise omit in first pass.
- Chat: prompt preset and system prompt.
- Audio: speech synthesis and dictation.
- Personalization: profile identity/password when signed in; guest empty state when not signed in.
- Data Controls: export, archive, delete.
- About: version and repo link.

Hide tabs with no backed settings. Do not invent settings to fill the requested category list.

## Advanced view

The pinned Advanced item is not a modal tab.

When clicked:

1. Close the settings modal.
2. Activate a registered view with `useViewStore.getState().setActiveView("advanced-settings")`.
3. Render `AdvancedSettingsComposerView` full-height inside the normal chat workspace shell.
4. Provide top bar with title, subtitle, and a back/close button.
5. Back/close calls `setActiveView(null)`.

Register the view once from a feature barrel/module, following the existing Component Gallery pattern. Chat/conversation/composer state remains preserved because `ChatWorkspace` already keeps chat state outside the active view branch.

Move current `AdvancedTab` and `DeveloperTab` content into this view:

- Experimental features.
- Poly Agent toggle.
- Performance/device controls.
- Dev SQL runner and update tester when dev mode is enabled.
- Memory advanced controls if experimental features are enabled and current Memory tab remains available.

Rename any user-facing "Developer/Admin Settings" language to "Advanced Settings" unless the control is explicitly dev-only.

## Search

Use a small static metadata index beside tab definitions. Match lowercased query against tab labels, descriptions, row labels, row descriptions, and keywords.

Behavior:

- Empty search shows normal nav.
- Search filters visible tabs to matches.
- Current panel can show matching rows for active tab where row metadata is available.
- Advanced remains pinned and visible.
- No DOM scraping.

## Persistence and dirty state

Most settings remain instant-save because the stores already persist immediately.

Only show footer Save/Reset for tabs that already stage local changes:

- Profile identity/password forms.
- Provider edit/add forms.
- Any future tab that exposes explicit local drafts.

Do not add a global draft layer around instant-save settings.

## Performance

- Keep `SettingsModal` lazy-loaded from `App.tsx`.
- Keep heavy tab content lazily mounted by selected/visited tab.
- Use Zustand selectors with `useShallow` where object slices are read.
- Keep search metadata static and memoized.
- Use `React.memo` only for repeated shell primitives that receive stable props.

## Error handling

- Provider add/edit/delete keeps current notifications and disables invalid saves.
- Dangerous data actions keep confirmation dialogs.
- Profile validation keeps email/password checks.
- Advanced SQL runner remains dev-gated and reports errors through notifications.
- If a registered advanced view is unavailable, the Advanced action should no-op with a notification rather than breaking the modal.

## Tests

Add the smallest useful checks:

- Settings metadata/search keeps Advanced pinned.
- Advanced action uses the existing view registry ID.
- Settings tab registry does not include empty invented tabs.

Run:

- `bun run build` for typecheck + Vite build.
- `bun run test`.
- Manual dark/light modal inspection.
- Manual Advanced open/close through view registry.

## Out of scope

- New settings not backed by existing stores.
- Provider/model storage logic changes.
- New dependency installation.
- Full config-driven settings renderer.
- Browser/Tauri API behavior changes outside settings wiring.
