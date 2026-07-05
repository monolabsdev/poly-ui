# Settings Experience Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Poly UI settings as a shadcn/ui + Tailwind modal, keep current store behavior, and move Advanced Settings into the existing full-height view registry.

**Architecture:** Add a pure settings registry for tab/search metadata, then replace the modal shell with shadcn primitives. Keep current tab components and stores, but split user-facing interface controls from experimental/developer controls. Register Advanced Settings as a `view-registry` view so chat state stays untouched.

**Tech Stack:** React 19, TypeScript, Vite, Tailwind v4, shadcn `radix-rhea`, Zustand, Vitest, existing `src/lib/view-registry.ts`.

## Global Constraints

- Use existing shadcn components already installed in `src/components/ui`; add no new dependencies.
- No raw hex/rgb colors in settings UI; use semantic tokens and existing CSS variables.
- Preserve every existing store-backed setting and action.
- Do not change provider/model/storage logic.
- Advanced Settings pinned sidebar entry closes the modal and opens `view-registry` ID `advanced-settings`.
- Hide tabs with no backed settings; do not invent settings to fill category names.
- Keep modal responsive at smaller desktop window sizes.
- Dangerous data actions keep confirmation.
- Most settings stay instant-save; Save/Reset appears only for local draft flows.
- Verification commands: `bun run build` and `bun run test`.

---

## File Structure

- `src/features/settings/settingsRegistry.ts`: pure tab metadata, search helpers, legacy tab aliases, Advanced view ID.
- `tests/settingsRegistry.test.ts`: pure Vitest coverage for tab visibility, search, and Advanced view ID.
- `src/features/settings/SettingsShell.tsx`: reusable shadcn/Tailwind shell components: dialog, sidebar, nav item, panel, section, row, control group.
- `src/features/settings/SettingComponents.tsx`: compatibility exports backed by the new shell primitives so existing tabs can migrate incrementally.
- `src/features/settings/SettingsModal.tsx`: normal modal orchestration, search state, visited-tab rendering, Advanced button handoff.
- `src/features/settings/tabs/InterfaceTab.tsx`: theme, language-adjacent interface controls, motion, transparency, app scale, empty-state model label.
- `src/features/settings/tabs/GeneralTab.tsx`: general controls that remain after Interface split.
- `src/features/settings/tabs/AdvancedSettingsContent.tsx`: experimental features and agent toggles from old `AdvancedTab`.
- `src/features/settings/DeveloperToolsSection.tsx`: dev SQL runner, update tester, idle tools, release notes test, Whisper unload, dev-mode exit.
- `src/features/settings/AdvancedSettingsComposerView.tsx`: full-height registered view with top bar and Advanced content.
- `src/features/settings/index.ts`: exports modal/types and imports the Advanced view registration.
- `src/App.tsx`: side-effect imports settings registration, wires `onOpenAdvancedSettings`, passes command context.
- `src/features/command-palette/settingsRegistry.tsx`: new tab IDs, legacy title cleanup, Advanced command opens view.
- Existing tab files under `src/features/settings/tabs/`: updated to use new row primitives and semantic shadcn props.

---

### Task 1: Add Settings Registry And Pure Tests

**Files:**
- Create: `src/features/settings/settingsRegistry.ts`
- Create: `tests/settingsRegistry.test.ts`

**Interfaces:**
- Produces: `SettingsTabId`, `SettingsTab`, `ADVANCED_SETTINGS_VIEW_ID`, `ADVANCED_SETTINGS_ITEM`, `SETTINGS_TABS`, `resolveSettingsTab(tab?: SettingsTab): SettingsTabId`, `filterSettingsTabs(query: string): SettingsTabDefinition[]`, `searchMatchesTab(tab, query): boolean`.
- Consumes: no app runtime state.

- [ ] **Step 1: Write failing tests**

Create `tests/settingsRegistry.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  ADVANCED_SETTINGS_ITEM,
  ADVANCED_SETTINGS_VIEW_ID,
  SETTINGS_TABS,
  filterSettingsTabs,
  resolveSettingsTab,
} from "../src/features/settings/settingsRegistry";

describe("settings registry", () => {
  it("keeps advanced pinned outside normal modal tabs", () => {
    expect(ADVANCED_SETTINGS_VIEW_ID).toBe("advanced-settings");
    expect(ADVANCED_SETTINGS_ITEM.id).toBe("advanced");
    expect(SETTINGS_TABS.map((tab) => tab.id)).not.toContain("advanced");
  });

  it("hides unbacked categories instead of inventing tabs", () => {
    expect(SETTINGS_TABS.map((tab) => tab.id)).toEqual([
      "general",
      "interface",
      "providers",
      "chat",
      "audio",
      "personalization",
      "data-controls",
      "about",
    ]);
  });

  it("maps legacy tab names from existing callers", () => {
    expect(resolveSettingsTab("connections")).toBe("providers");
    expect(resolveSettingsTab("profile")).toBe("personalization");
    expect(resolveSettingsTab("personalisation")).toBe("chat");
    expect(resolveSettingsTab("speech")).toBe("audio");
    expect(resolveSettingsTab("advanced")).toBe("general");
    expect(resolveSettingsTab()).toBe("general");
  });

  it("filters tabs by labels descriptions and keywords", () => {
    expect(filterSettingsTabs("ollama").map((tab) => tab.id)).toEqual(["providers"]);
    expect(filterSettingsTabs("whisper").map((tab) => tab.id)).toEqual(["audio"]);
    expect(filterSettingsTabs("prompt").map((tab) => tab.id)).toEqual(["chat"]);
    expect(filterSettingsTabs("")).toHaveLength(SETTINGS_TABS.length);
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun run test -- tests/settingsRegistry.test.ts`

Expected: FAIL with import error for `settingsRegistry`.

- [ ] **Step 3: Add registry implementation**

Create `src/features/settings/settingsRegistry.ts`:

```ts
import {
  Bell,
  Brush,
  CircleUserRound,
  Cpu,
  Info,
  MessageSquareText,
  Mic,
  Shield,
  SlidersHorizontal,
  type LucideIcon,
} from "lucide-react";

export const ADVANCED_SETTINGS_VIEW_ID = "advanced-settings";

export type SettingsTabId =
  | "general"
  | "interface"
  | "providers"
  | "chat"
  | "audio"
  | "personalization"
  | "data-controls"
  | "about";

export type LegacySettingsTab =
  | "connections"
  | "profile"
  | "personalisation"
  | "speech"
  | "advanced";

export type SettingsTab = SettingsTabId | LegacySettingsTab;

export type SettingsTabDefinition = {
  id: SettingsTabId;
  label: string;
  description: string;
  icon: LucideIcon;
  keywords: string[];
};

export type AdvancedSettingsNavItem = {
  id: "advanced";
  label: string;
  description: string;
  icon: LucideIcon;
  keywords: string[];
  viewId: typeof ADVANCED_SETTINGS_VIEW_ID;
};

export const SETTINGS_TABS: SettingsTabDefinition[] = [
  {
    id: "general",
    label: "General",
    description: "Language and notification defaults.",
    icon: Bell,
    keywords: ["settings", "preferences", "language", "notifications", "toast"],
  },
  {
    id: "interface",
    label: "Interface",
    description: "Theme, motion, transparency, app scale, and empty-state display.",
    icon: Brush,
    keywords: ["appearance", "theme", "dark", "light", "motion", "transparency", "zoom", "scale"],
  },
  {
    id: "providers",
    label: "Providers",
    description: "Ollama, OpenAI-compatible providers, and web search.",
    icon: Cpu,
    keywords: ["connections", "providers", "models", "ollama", "openai", "web", "search", "api"],
  },
  {
    id: "chat",
    label: "Chat",
    description: "Prompt preset and custom system prompt.",
    icon: MessageSquareText,
    keywords: ["composer", "prompt", "assistant", "system", "personalisation", "personalization"],
  },
  {
    id: "audio",
    label: "Audio",
    description: "Speech synthesis, dictation, and Whisper models.",
    icon: Mic,
    keywords: ["speech", "voice", "tts", "dictation", "whisper", "microphone"],
  },
  {
    id: "personalization",
    label: "Personalization",
    description: "Profile, account identity, avatar, and password.",
    icon: CircleUserRound,
    keywords: ["profile", "account", "email", "avatar", "password", "identity"],
  },
  {
    id: "data-controls",
    label: "Data Controls",
    description: "Export, archive, and delete chat data.",
    icon: Shield,
    keywords: ["data", "export", "archive", "delete", "backup", "privacy"],
  },
  {
    id: "about",
    label: "About",
    description: "App version and project information.",
    icon: Info,
    keywords: ["version", "release", "github", "polyui"],
  },
];

export const ADVANCED_SETTINGS_ITEM: AdvancedSettingsNavItem = {
  id: "advanced",
  label: "Advanced",
  description: "Experimental, developer, diagnostics, and low-level configuration.",
  icon: SlidersHorizontal,
  keywords: ["advanced", "developer", "experimental", "agent", "diagnostics", "sql"],
  viewId: ADVANCED_SETTINGS_VIEW_ID,
};

const tabAliases: Partial<Record<SettingsTab, SettingsTabId>> = {
  connections: "providers",
  profile: "personalization",
  personalisation: "chat",
  speech: "audio",
  advanced: "general",
};

export function resolveSettingsTab(tab?: SettingsTab): SettingsTabId {
  if (!tab) return "general";
  if (tabAliases[tab]) return tabAliases[tab];
  return SETTINGS_TABS.some((item) => item.id === tab) ? tab : "general";
}

function searchableText(tab: Pick<SettingsTabDefinition, "label" | "description" | "keywords">) {
  return `${tab.label} ${tab.description} ${tab.keywords.join(" ")}`.toLowerCase();
}

export function searchMatchesTab(tab: SettingsTabDefinition, query: string) {
  const normalized = query.trim().toLowerCase();
  return !normalized || searchableText(tab).includes(normalized);
}

export function filterSettingsTabs(query: string) {
  return SETTINGS_TABS.filter((tab) => searchMatchesTab(tab, query));
}
```

- [ ] **Step 4: Run tests to verify pass**

Run: `bun run test -- tests/settingsRegistry.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/settings/settingsRegistry.ts tests/settingsRegistry.test.ts
git commit -m "feat(settings): add settings registry"
```

---

### Task 2: Add Settings Shell Primitives

**Files:**
- Create: `src/features/settings/SettingsShell.tsx`
- Modify: `src/features/settings/SettingComponents.tsx`

**Interfaces:**
- Consumes: `SettingsTabDefinition`, `AdvancedSettingsNavItem`.
- Produces: `SettingsDialog`, `SettingsSidebar`, `SettingsSearch`, `SettingsNavItem`, `SettingsPanel`, `SettingsSection`, `SettingRow`, `SettingControlGroup`, compatibility `SettingCard`, `SectionHeader`, `EmptyState`.

- [ ] **Step 1: Write static regression test**

Create no React DOM test. Add this import at the top of `tests/settingsRegistry.test.ts`:

```ts
import { readFileSync } from "node:fs";
```

Add this check inside the existing `describe("settings registry", ...)` block:

```ts
it("settings shell uses semantic Tailwind tokens only", () => {
  const shell = readFileSync("src/features/settings/SettingsShell.tsx", "utf8");
  expect(shell).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|rgba\(/);
  expect(shell).not.toMatch(/\bspace-[xy]-/);
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun run test -- tests/settingsRegistry.test.ts`

Expected: FAIL with missing `SettingsShell.tsx`.

- [ ] **Step 3: Create shell primitives**

Create `src/features/settings/SettingsShell.tsx` with these exports:

```tsx
import type { ReactNode } from "react";
import { memo } from "react";
import { Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type {
  AdvancedSettingsNavItem,
  SettingsTabDefinition,
  SettingsTabId,
} from "./settingsRegistry";

type SettingsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export function SettingsDialog({ open, onOpenChange, children }: SettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="grid h-[min(88dvh,760px)] w-[min(1180px,calc(100vw-2rem))] max-w-none grid-cols-1 gap-0 overflow-hidden rounded-[min(var(--radius-4xl),24px)] border-border/60 bg-card p-0 shadow-2xl md:grid-cols-[244px_minmax(0,1fr)]"
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

type SettingsSearchProps = {
  value: string;
  onChange: (value: string) => void;
};

export const SettingsSearch = memo(function SettingsSearch({ value, onChange }: SettingsSearchProps) {
  return (
    <InputGroup>
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        aria-label="Search settings"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search settings"
      />
      {value ? (
        <InputGroupAddon align="inline-end">
          <InputGroupButton size="icon-xs" aria-label="Clear settings search" onClick={() => onChange("")}>
            <X />
          </InputGroupButton>
        </InputGroupAddon>
      ) : null}
    </InputGroup>
  );
});

type SettingsNavItemProps = {
  item: SettingsTabDefinition | AdvancedSettingsNavItem;
  active?: boolean;
  onClick: () => void;
};

export const SettingsNavItem = memo(function SettingsNavItem({ item, active = false, onClick }: SettingsNavItemProps) {
  const Icon = item.icon;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-xl px-3 text-left text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-accent-foreground focus-visible:ring-1 focus-visible:ring-ring",
        active && "bg-accent text-accent-foreground",
      )}
    >
      <Icon className="shrink-0" />
      <span className="truncate">{item.label}</span>
    </button>
  );
});

type SettingsSidebarProps = {
  tabs: SettingsTabDefinition[];
  activeTab: SettingsTabId;
  query: string;
  advancedItem: AdvancedSettingsNavItem;
  onQueryChange: (value: string) => void;
  onSelectTab: (tab: SettingsTabId) => void;
  onOpenAdvanced: () => void;
};

export function SettingsSidebar({
  tabs,
  activeTab,
  query,
  advancedItem,
  onQueryChange,
  onSelectTab,
  onOpenAdvanced,
}: SettingsSidebarProps) {
  return (
    <aside className="flex min-h-0 flex-col border-b border-border/60 bg-muted/30 p-3 md:border-r md:border-b-0">
      <div className="flex flex-col gap-3">
        <div className="px-1">
          <DialogTitle className="text-lg font-semibold">Settings</DialogTitle>
          <DialogDescription className="mt-1 text-xs">
            Configure Poly UI for this device.
          </DialogDescription>
        </div>
        <SettingsSearch value={query} onChange={onQueryChange} />
      </div>
      <ScrollArea className="mt-3 min-h-0 flex-1">
        <nav className="flex flex-col gap-1 pr-1" aria-label="Settings sections">
          {tabs.map((tab) => (
            <SettingsNavItem
              key={tab.id}
              item={tab}
              active={activeTab === tab.id}
              onClick={() => onSelectTab(tab.id)}
            />
          ))}
        </nav>
      </ScrollArea>
      <Separator className="my-3" />
      <SettingsNavItem item={advancedItem} onClick={onOpenAdvanced} />
    </aside>
  );
}

type SettingsPanelProps = {
  title: string;
  description?: string;
  onClose: () => void;
  footer?: ReactNode;
  children: ReactNode;
};

export function SettingsPanel({ title, description, onClose, footer, children }: SettingsPanelProps) {
  return (
    <section className="flex min-h-0 flex-col bg-card">
      <header className="flex min-h-16 shrink-0 items-start justify-between gap-4 border-b border-border/60 px-5 py-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-none">{title}</h2>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        <Button type="button" variant="ghost" size="icon-sm" onClick={onClose} aria-label="Close settings">
          <X />
        </Button>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-5">{children}</div>
      </ScrollArea>
      {footer ? <footer className="border-t border-border/60 px-5 py-3">{footer}</footer> : null}
    </section>
  );
}

export function SettingsSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children ? <div className="flex flex-col gap-2">{children}</div> : null}
    </section>
  );
}

export function SettingRow({
  title,
  description,
  action,
  children,
  className,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border/60 bg-background/50 p-4", className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-sm font-medium">{title}</div>
          {description ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
        </div>
        {action ? <div className="shrink-0 sm:pt-0.5">{action}</div> : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

export function SettingControlGroup({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex flex-wrap items-center gap-2", className)}>{children}</div>;
}
```

- [ ] **Step 4: Bridge old setting components**

Replace `src/features/settings/SettingComponents.tsx` with compatibility wrappers:

```tsx
import type React from "react";
import { Badge as ShadcnBadge } from "@/components/ui/badge";
import { Empty, EmptyDescription } from "@/components/ui/empty";
import {
  SettingRow,
  SettingsSection,
} from "./SettingsShell";

export const settingSurfaceClassName = "rounded-xl border border-border/60 bg-background/50 p-4";

export function SettingSurface({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`${settingSurfaceClassName} ${className ?? ""}`}>{children}</div>;
}

export function SettingCard({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <SettingRow title={title} description={description} action={action}>
      {children}
    </SettingRow>
  );
}

export function SectionHeader({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <SettingsSection title={title} description={description} action={action} />
    </div>
  );
}

export function Badge({ label }: { label: string; color?: string }) {
  return <ShadcnBadge variant="secondary">{label}</ShadcnBadge>;
}

export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <Empty className="rounded-xl border border-dashed border-border/60 p-6">
      <EmptyDescription>{children}</EmptyDescription>
    </Empty>
  );
}

export const selectClassName = "min-w-36";
```

- [ ] **Step 5: Run static test**

Run: `bun run test -- tests/settingsRegistry.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/SettingsShell.tsx src/features/settings/SettingComponents.tsx tests/settingsRegistry.test.ts
git commit -m "feat(settings): add settings shell"
```

---

### Task 3: Rebuild Normal Settings Modal

**Files:**
- Modify: `src/features/settings/SettingsModal.tsx`
- Modify: `src/features/settings/index.ts`

**Interfaces:**
- Consumes: `SETTINGS_TABS`, `ADVANCED_SETTINGS_ITEM`, `resolveSettingsTab`.
- Produces: `SettingsModal({ isOpen, onClose, initialTab, onOpenAdvancedSettings })` and exported `SettingsTab` type.

- [ ] **Step 1: Write static test for Advanced not rendered as modal tab**

Add to `tests/settingsRegistry.test.ts`:

```ts
it("settings modal delegates advanced instead of rendering an advanced tab", () => {
  const modal = readFileSync("src/features/settings/SettingsModal.tsx", "utf8");
  expect(modal).toContain("onOpenAdvancedSettings");
  expect(modal).not.toContain("<AdvancedTab");
  expect(modal).not.toContain("<DeveloperTab");
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun run test -- tests/settingsRegistry.test.ts`

Expected: FAIL because current modal renders `AdvancedTab` and `DeveloperTab`.

- [ ] **Step 3: Replace modal orchestration**

Replace `src/features/settings/SettingsModal.tsx` with a small shell-driven modal. Keep the lazy visited-tab behavior:

```tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ADVANCED_SETTINGS_ITEM,
  SETTINGS_TABS,
  filterSettingsTabs,
  resolveSettingsTab,
  type SettingsTab,
  type SettingsTabId,
} from "./settingsRegistry";
import {
  SettingsDialog,
  SettingsPanel,
  SettingsSidebar,
} from "./SettingsShell";
import { AboutTab } from "./tabs/AboutTab";
import { ConnectionsTab } from "./tabs/ConnectionsTab";
import { DataControlsTab } from "./tabs/DataControlsTab";
import { GeneralTab } from "./tabs/GeneralTab";
import { PersonalisationTab } from "./tabs/PersonalisationTab";
import { ProfileTab } from "./tabs/ProfileTab";
import { SpeechTab } from "./tabs/SpeechTab";

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
  onOpenAdvancedSettings?: () => void;
};

function renderTab(tab: SettingsTabId) {
  switch (tab) {
    case "general":
      return <GeneralTab />;
    case "interface":
      return <GeneralTab />;
    case "providers":
      return <ConnectionsTab />;
    case "chat":
      return <PersonalisationTab />;
    case "audio":
      return <SpeechTab />;
    case "personalization":
      return <ProfileTab />;
    case "data-controls":
      return <DataControlsTab />;
    case "about":
      return <AboutTab />;
  }
}

export function SettingsModal({
  isOpen,
  onClose,
  initialTab = "general",
  onOpenAdvancedSettings = () => undefined,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTabId>(() => resolveSettingsTab(initialTab));
  const [visitedTabs, setVisitedTabs] = useState<Set<SettingsTabId>>(
    () => new Set([resolveSettingsTab(initialTab)]),
  );
  const [query, setQuery] = useState("");

  const tabs = useMemo(() => filterSettingsTabs(query), [query]);
  const activeItem = SETTINGS_TABS.find((tab) => tab.id === activeTab) ?? SETTINGS_TABS[0];

  const selectTab = useCallback((tab: SettingsTabId) => {
    setActiveTab(tab);
    setVisitedTabs((prev) => (prev.has(tab) ? prev : new Set(prev).add(tab)));
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const nextTab = resolveSettingsTab(initialTab);
    selectTab(nextTab);
  }, [initialTab, isOpen, selectTab]);

  useEffect(() => {
    if (tabs.some((tab) => tab.id === activeTab)) return;
    selectTab(tabs[0]?.id ?? "general");
  }, [activeTab, selectTab, tabs]);

  const openAdvanced = useCallback(() => {
    onClose();
    onOpenAdvancedSettings();
  }, [onClose, onOpenAdvancedSettings]);

  return (
    <SettingsDialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SettingsSidebar
        tabs={tabs}
        activeTab={activeTab}
        query={query}
        advancedItem={ADVANCED_SETTINGS_ITEM}
        onQueryChange={setQuery}
        onSelectTab={selectTab}
        onOpenAdvanced={openAdvanced}
      />
      <SettingsPanel
        title={activeItem.label}
        description={activeItem.description}
        onClose={onClose}
      >
        {[...visitedTabs].map((tab) => (
          <div key={tab} className={tab === activeTab ? "block" : "hidden"}>
            {renderTab(tab)}
          </div>
        ))}
      </SettingsPanel>
    </SettingsDialog>
  );
}

export type { SettingsTab } from "./settingsRegistry";
```

The Interface tab intentionally reuses `GeneralTab` for this task so this commit compiles before Task 4 splits interface-specific rows.

- [ ] **Step 4: Update barrel exports**

Change `src/features/settings/index.ts`:

```ts
export { SettingsModal } from "./SettingsModal";
export type { SettingsTab } from "./settingsRegistry";
```

- [ ] **Step 5: Run registry test and build**

Run: `bun run test -- tests/settingsRegistry.test.ts`

Expected: PASS.

Run: `bun run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/SettingsModal.tsx src/features/settings/index.ts tests/settingsRegistry.test.ts
git commit -m "feat(settings): rebuild settings modal shell"
```

---

### Task 4: Create Canonical Tab Wrappers

**Files:**
- Create: `src/features/settings/tabs/ProvidersTab.tsx`
- Create: `src/features/settings/tabs/AudioTab.tsx`
- Create: `src/features/settings/tabs/ChatTab.tsx`
- Create: `src/features/settings/tabs/PersonalizationTab.tsx`
- Create: `src/features/settings/tabs/InterfaceTab.tsx`
- Modify: `src/features/settings/tabs/GeneralTab.tsx`
- Modify: `src/features/settings/SettingsModal.tsx`

**Interfaces:**
- Produces canonical tab component names consumed by `SettingsModal.tsx`.
- Consumes current existing tabs and stores.

- [ ] **Step 1: Add canonical wrapper files**

Create `src/features/settings/tabs/ProvidersTab.tsx`:

```tsx
export { ConnectionsTab as ProvidersTab } from "./ConnectionsTab";
```

Create `src/features/settings/tabs/AudioTab.tsx`:

```tsx
export { SpeechTab as AudioTab } from "./SpeechTab";
```

Create `src/features/settings/tabs/ChatTab.tsx`:

```tsx
export { PersonalisationTab as ChatTab } from "./PersonalisationTab";
```

Create `src/features/settings/tabs/PersonalizationTab.tsx`:

```tsx
export { ProfileTab as PersonalizationTab } from "./ProfileTab";
```

- [ ] **Step 2: Create Interface tab**

Create `src/features/settings/tabs/InterfaceTab.tsx`:

```tsx
import { useShallow } from "zustand/react/shallow";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { SettingsSection, SettingRow } from "../SettingsShell";
import { useSettingsStore } from "@/store/settingsStore";
import { useThemeStore, type ThemeMode } from "@/store/themeStore";

export function InterfaceTab() {
  const { mode, setMode } = useThemeStore(
    useShallow((state) => ({
      mode: state.mode,
      setMode: state.setMode,
    })),
  );
  const { showModelInEmptyState, performance, actions } = useSettingsStore(
    useShallow((state) => ({
      showModelInEmptyState: state.general.showModelInEmptyState,
      performance: state.performance,
      actions: state.actions,
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title="Appearance"
        description="Control how Poly UI looks in this desktop window."
      >
        <SettingRow
          title="Theme"
          description="Choose light, dark, or system appearance."
          action={
            <Select value={mode} onValueChange={(value) => setMode(value as ThemeMode)}>
              <SelectTrigger size="sm" className="min-w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          }
        />
        <SettingRow
          title="Show model in empty state"
          description="Display the active model name instead of the greeting when no messages exist."
          action={
            <Switch
              checked={showModelInEmptyState}
              onCheckedChange={(checked) => actions.updateGeneral({ showModelInEmptyState: checked })}
            />
          }
        />
      </SettingsSection>

      <SettingsSection
        title="Performance"
        description="Tune motion and surface effects for this device."
      >
        <SettingRow
          title="Reduce motion"
          description="Minimize animated transitions and loaders."
          action={
            <Switch
              checked={performance.reduceMotion}
              onCheckedChange={(checked) => actions.updatePerformance({ reduceMotion: checked })}
            />
          }
        />
        <SettingRow
          title="Reduce transparency"
          description="Prefer solid surfaces over transparent window effects."
          action={
            <Switch
              checked={performance.reduceTransparency}
              onCheckedChange={(checked) => actions.updatePerformance({ reduceTransparency: checked })}
            />
          }
        />
        <SettingRow
          title="App scale"
          description={`${Math.round(performance.appZoom * 100)}%`}
        >
          <Slider
            value={performance.appZoom}
            min={0.5}
            max={2}
            step={0.1}
            onChange={(_, value) =>
              actions.updatePerformance({
                appZoom: Array.isArray(value) ? value[0] : value,
              })
            }
          />
        </SettingRow>
      </SettingsSection>
    </div>
  );
}
```

- [ ] **Step 3: Slim General tab**

Replace `src/features/settings/tabs/GeneralTab.tsx` with:

```tsx
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useShallow } from "zustand/react/shallow";
import { SettingsSection, SettingRow } from "../SettingsShell";
import { useSettingsStore } from "@/store/settingsStore";

export function GeneralTab() {
  const { general, actions } = useSettingsStore(
    useShallow((state) => ({
      general: state.general,
      actions: state.actions,
    })),
  );

  return (
    <SettingsSection title="General" description="Default app preferences.">
      <SettingRow
        title="Language"
        description="UI language preference."
        action={
          <Select value={general.language} onValueChange={(value) => actions.updateGeneral({ language: value })}>
            <SelectTrigger size="sm" className="min-w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="en">English</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        }
      />
      <SettingRow
        title="Notifications"
        description="Show toast notifications for events."
        action={
          <Switch
            checked={general.notifications}
            onCheckedChange={(checked) => actions.updateGeneral({ notifications: checked })}
          />
        }
      />
    </SettingsSection>
  );
}
```

- [ ] **Step 4: Switch modal to canonical tabs**

In `src/features/settings/SettingsModal.tsx`, switch `renderTab` to the canonical wrappers:

```tsx
import { AudioTab } from "./tabs/AudioTab";
import { ChatTab } from "./tabs/ChatTab";
import { InterfaceTab } from "./tabs/InterfaceTab";
import { PersonalizationTab } from "./tabs/PersonalizationTab";
import { ProvidersTab } from "./tabs/ProvidersTab";
```

Then change these cases:

```tsx
case "interface":
  return <InterfaceTab />;
case "providers":
  return <ProvidersTab />;
case "chat":
  return <ChatTab />;
case "audio":
  return <AudioTab />;
case "personalization":
  return <PersonalizationTab />;
```

- [ ] **Step 5: Run build**

Run: `bun run build`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/features/settings/tabs/ProvidersTab.tsx src/features/settings/tabs/AudioTab.tsx src/features/settings/tabs/ChatTab.tsx src/features/settings/tabs/PersonalizationTab.tsx src/features/settings/tabs/InterfaceTab.tsx src/features/settings/tabs/GeneralTab.tsx src/features/settings/SettingsModal.tsx
git commit -m "feat(settings): add canonical settings tabs"
```

---

### Task 5: Register Advanced Settings View

**Files:**
- Create: `src/features/settings/tabs/AdvancedSettingsContent.tsx`
- Create: `src/features/settings/DeveloperToolsSection.tsx`
- Create: `src/features/settings/AdvancedSettingsComposerView.tsx`
- Modify: `src/App.tsx`
- Modify: `src/features/settings/index.ts`

**Interfaces:**
- Produces: registered view ID `advanced-settings`.
- Consumes: `useViewStore`, old `AdvancedTab` behavior, old `DeveloperTab` behavior.

- [ ] **Step 1: Write registry static test**

Add to `tests/settingsRegistry.test.ts`:

```ts
it("advanced settings view registers with view-registry", () => {
  const view = readFileSync("src/features/settings/AdvancedSettingsComposerView.tsx", "utf8");
  expect(view).toContain("registerView(ADVANCED_SETTINGS_VIEW_ID, AdvancedSettingsComposerView)");
  expect(view).toContain("setActiveView(null)");
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun run test -- tests/settingsRegistry.test.ts`

Expected: FAIL because `AdvancedSettingsComposerView.tsx` does not exist.

- [ ] **Step 3: Create Advanced content**

Create `src/features/settings/tabs/AdvancedSettingsContent.tsx` by moving the old experimental controls from `AdvancedTab.tsx`, minus performance rows moved to `InterfaceTab.tsx`:

```tsx
import { useShallow } from "zustand/react/shallow";
import { Switch } from "@/components/ui/switch";
import { SettingsSection, SettingRow } from "../SettingsShell";
import { useSettingsStore } from "@/store/settingsStore";
import { useAgentStore } from "@/features/agent/agentStore";
import { disableMemoryForOwner } from "@/features/memory/memoryClient";
import { getCurrentProviderAccountId } from "@/features/providers";

export function AdvancedSettingsContent() {
  const { experimentalFeatures, actions } = useSettingsStore(
    useShallow((state) => ({
      experimentalFeatures: state.general.experimentalFeatures,
      actions: state.actions,
    })),
  );
  const agentEnabled = useAgentStore((state) => state.enabled);
  const setAgentEnabled = useAgentStore((state) => state.actions.setEnabled);

  const handleExperimentalToggle = (checked: boolean) => {
    actions.updateGeneral({ experimentalFeatures: checked });
    if (!checked) {
      setAgentEnabled(false);
      void disableMemoryForOwner(getCurrentProviderAccountId()).catch(() => undefined);
    }
  };

  return (
    <SettingsSection
      title="Experimental"
      description="Upcoming features before they are stable."
    >
      <SettingRow
        title="Enable experimental features"
        description="Unlocks in-development features like Poly Agent and memory."
        action={
          <Switch
            checked={experimentalFeatures}
            onCheckedChange={handleExperimentalToggle}
          />
        }
      />
      <SettingRow
        title="Poly Agent"
        description="Experimental agent mode for workspace inspection and file edits."
        action={
          <Switch
            checked={experimentalFeatures && agentEnabled}
            disabled={!experimentalFeatures}
            onCheckedChange={setAgentEnabled}
          />
        }
      >
        <p className="text-sm text-muted-foreground">
          Off by default. Requires explicit tool approvals unless you choose a broader approval preset in chat.
        </p>
      </SettingRow>
    </SettingsSection>
  );
}
```

- [ ] **Step 4: Create developer tools section**

Create `src/features/settings/DeveloperToolsSection.tsx` by moving old `DeveloperTab` code from `SettingsModal.tsx`. Keep the component name `DeveloperToolsSection`, title text `Developer tools`, and section description `Diagnostics and test controls for development builds.`. Keep these actions exactly: SQL runner, simulated update download, clear update state, test release notes, idle force active/idle, unload Whisper model, deactivate dev mode.

- [ ] **Step 5: Create registered view**

Create `src/features/settings/AdvancedSettingsComposerView.tsx`:

```tsx
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useDevStore } from "@/store/devStore";
import { registerView, useViewStore } from "@/lib/view-registry";
import { ADVANCED_SETTINGS_VIEW_ID } from "./settingsRegistry";
import { DeveloperToolsSection } from "./DeveloperToolsSection";
import { AdvancedSettingsContent } from "./tabs/AdvancedSettingsContent";

export function AdvancedSettingsComposerView() {
  const devMode = useDevStore((state) => state.devMode);
  const close = () => useViewStore.getState().setActiveView(null);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col bg-background">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border/60 px-6 py-5">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold">Advanced Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Experimental, developer, diagnostics, and low-level configuration.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={close}>
          <ArrowLeft data-icon="inline-start" />
          Back
        </Button>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 py-6">
          <AdvancedSettingsContent />
          {devMode ? <DeveloperToolsSection /> : null}
        </div>
      </ScrollArea>
    </div>
  );
}

registerView(ADVANCED_SETTINGS_VIEW_ID, AdvancedSettingsComposerView);
```

- [ ] **Step 6: Ensure registration loads**

At the top of `src/features/settings/index.ts`, add:

```ts
import "./AdvancedSettingsComposerView";
```

At the top of `src/App.tsx`, add:

```ts
import "@/features/settings";
```

Keep existing lazy import for `SettingsModal`.

- [ ] **Step 7: Run tests**

Run: `bun run test -- tests/settingsRegistry.test.ts`

Expected: PASS.

- [ ] **Step 8: Run build**

Run: `bun run build`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add src/features/settings/tabs/AdvancedSettingsContent.tsx src/features/settings/DeveloperToolsSection.tsx src/features/settings/AdvancedSettingsComposerView.tsx src/features/settings/index.ts src/App.tsx tests/settingsRegistry.test.ts
git commit -m "feat(settings): add advanced settings view"
```

---

### Task 6: Wire Advanced Open Paths

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/features/command-palette/settingsRegistry.tsx`
- Modify: `src/hooks/useCommandPaletteItems.tsx` only if its settings typing rejects new tab IDs.

**Interfaces:**
- Consumes: `ADVANCED_SETTINGS_VIEW_ID`, `useViewStore`.
- Produces: `openAdvancedSettings` app callback and command palette action.

- [ ] **Step 1: Add static test for command palette Advanced path**

Add to `tests/settingsRegistry.test.ts`:

```ts
it("command palette opens advanced settings through the view registry", () => {
  const commands = readFileSync("src/features/command-palette/settingsRegistry.tsx", "utf8");
  expect(commands).toContain("openAdvancedSettings");
  expect(commands).toContain("settings-advanced");
  expect(commands).not.toContain('tab: "advanced"');
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun run test -- tests/settingsRegistry.test.ts`

Expected: FAIL because command palette still routes Advanced to modal tab.

- [ ] **Step 3: Wire App callback**

In `src/App.tsx` import:

```ts
import { useViewStore } from "@/lib/view-registry";
import { ADVANCED_SETTINGS_VIEW_ID } from "@/features/settings/settingsRegistry";
```

Add callback near `handleCloseSettings`:

```ts
const handleOpenAdvancedSettings = useCallback(() => {
  setIsSettingsOpen(false);
  useViewStore.getState().setActiveView(ADVANCED_SETTINGS_VIEW_ID);
}, []);
```

Pass it to `useSettingsCommands`:

```ts
const settingsCommands = useSettingsCommands({
  openSettings: handleOpenSettings,
  openAdvancedSettings: handleOpenAdvancedSettings,
});
```

Pass it to modal:

```tsx
<SettingsModalLazy
  isOpen={isSettingsOpen}
  onClose={handleCloseSettings}
  initialTab={settingsInitialTab}
  onOpenAdvancedSettings={handleOpenAdvancedSettings}
/>
```

- [ ] **Step 4: Update command palette settings registry**

In `src/features/command-palette/settingsRegistry.tsx`:

```ts
export type SettingsCommandContext = {
  openSettings: (tab: SettingsTab) => void;
  openAdvancedSettings: () => void;
};
```

Change the Advanced entry:

```ts
{
  id: "settings-advanced",
  title: "Advanced Settings",
  description: "Experimental, developer, diagnostics, and low-level configuration",
  tab: "general",
  keywords: ["advanced", "experiment", "experimental", "features", "developer"],
  icon: SlidersHorizontal,
  execute: ({ openAdvancedSettings }) => openAdvancedSettings(),
}
```

To support context-aware execute, change `SettingsEntry.execute` type:

```ts
execute?: (context: SettingsCommandContext) => void;
```

Change command creation:

```ts
execute: entry.execute
  ? () => entry.execute?.({ openSettings, openAdvancedSettings })
  : () => openSettings(entry.tab),
```

Update hook signature:

```ts
export function useSettingsCommands({
  openSettings,
  openAdvancedSettings,
}: SettingsCommandContext): CommandPaletteItem[] {
```

Add `openAdvancedSettings` to the `useMemo` dependency list.

- [ ] **Step 5: Run tests**

Run: `bun run test -- tests/settingsRegistry.test.ts`

Expected: PASS.

- [ ] **Step 6: Run build**

Run: `bun run build`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/features/command-palette/settingsRegistry.tsx tests/settingsRegistry.test.ts
git commit -m "feat(settings): wire advanced settings navigation"
```

---

### Task 7: Polish Existing Tab Content With New Rows

**Files:**
- Modify: `src/features/settings/tabs/PersonalisationTab.tsx`
- Modify: `src/features/settings/tabs/ProfileTab.tsx`
- Modify: `src/features/settings/tabs/SpeechTab.tsx`
- Modify: `src/features/settings/tabs/ConnectionsTab.tsx`
- Modify: `src/features/web-search/WebSearchSettings.tsx`
- Modify: `src/features/memory/MemoryTab.tsx`

**Interfaces:**
- Consumes: `SettingsSection`, `SettingRow`, `SettingControlGroup`.
- Produces: no store/API changes; visual-only row migration.

- [ ] **Step 1: Add static no-raw-color test**

Add to `tests/settingsRegistry.test.ts`:

```ts
it("settings feature avoids raw colors and space utilities", () => {
  const files = [
    "src/features/settings/tabs/PersonalisationTab.tsx",
    "src/features/settings/tabs/ProfileTab.tsx",
    "src/features/settings/tabs/SpeechTab.tsx",
    "src/features/settings/tabs/ConnectionsTab.tsx",
    "src/features/web-search/WebSearchSettings.tsx",
    "src/features/memory/MemoryTab.tsx",
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    expect(source, file).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|rgba\(/);
    expect(source, file).not.toMatch(/\bspace-[xy]-/);
  }
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `bun run test -- tests/settingsRegistry.test.ts`

Expected: FAIL on current `space-y-*` and `bg-black/45 text-white` usages.

- [ ] **Step 3: Migrate Chat tab content**

In `src/features/settings/tabs/PersonalisationTab.tsx`, replace wrapper `div`, `h3`, `p`, raw bordered prompt block, and `space-y-*` classes with `SettingsSection`, `SettingRow`, and `Textarea`. Keep `PROMPT_PRESETS`, `RadioGroup`, and store actions unchanged.

- [ ] **Step 4: Migrate Profile tab colors**

In `src/features/settings/tabs/ProfileTab.tsx`, replace avatar overlay class:

```tsx
className="pointer-events-none absolute inset-0 grid place-items-center rounded-full bg-foreground/55 text-background opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
```

Keep validation and save behavior unchanged.

- [ ] **Step 5: Migrate Speech tab row wrappers**

In `src/features/settings/tabs/SpeechTab.tsx`, keep all dictation and TTS logic unchanged. Replace `SectionHeader`/`SettingCard` usage with shell primitives only where a small local edit reduces old visual clutter. Keep `DictationModelDialog` unchanged.

- [ ] **Step 6: Migrate Connections tab row wrappers**

In `src/features/settings/tabs/ConnectionsTab.tsx`, keep provider add/edit/delete behavior unchanged. Replace `confirm(...)` in `handleDelete` with existing `ConfirmDialog` before this task ends:

```tsx
const [deleteTarget, setDeleteTarget] = useState<ProviderStatusResponse | null>(null);
```

Use `ConfirmDialog`:

```tsx
<ConfirmDialog
  open={Boolean(deleteTarget)}
  onOpenChange={(open) => {
    if (!open) setDeleteTarget(null);
  }}
  title="Delete connection?"
  description={
    deleteTarget
      ? `Delete "${lookupPreset(deleteTarget.config.preset, deleteTarget.config.api_base_url ?? null).label}" connection?`
      : undefined
  }
  confirmLabel="Delete"
  destructive
  onConfirm={() => {
    if (deleteTarget) void deleteProvider(deleteTarget);
  }}
/>
```

Extract existing async delete body into `deleteProvider(provider: ProviderStatusResponse)`.

- [ ] **Step 7: Migrate web search rows**

In `src/features/web-search/WebSearchSettings.tsx`, keep `useWebSearchConfig` and `updateGeneral` unchanged. Use shadcn `Select` from `@/components/ui/select` instead of native-select wrappers.

- [ ] **Step 8: Leave Memory behavior intact**

In `src/features/memory/MemoryTab.tsx`, only remove `space-*` utilities and raw visual drift caught by the static test. Do not change memory API calls.

- [ ] **Step 9: Run tests**

Run: `bun run test -- tests/settingsRegistry.test.ts`

Expected: PASS.

- [ ] **Step 10: Run build**

Run: `bun run build`

Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add src/features/settings/tabs/PersonalisationTab.tsx src/features/settings/tabs/ProfileTab.tsx src/features/settings/tabs/SpeechTab.tsx src/features/settings/tabs/ConnectionsTab.tsx src/features/web-search/WebSearchSettings.tsx src/features/memory/MemoryTab.tsx tests/settingsRegistry.test.ts
git commit -m "refactor(settings): polish settings tab rows"
```

---

### Task 8: Final Verification And Manual Checks

**Files:**
- Modify only files with fixups found during verification.

**Interfaces:**
- Produces: passing build/tests and manual verification notes.

- [ ] **Step 1: Run full build**

Run: `bun run build`

Expected: PASS with no TypeScript or Vite errors.

- [ ] **Step 2: Run full tests**

Run: `bun run test`

Expected: PASS.

- [ ] **Step 3: Start dev server**

Run: `bun run dev -- --host 127.0.0.1`

Expected: Vite prints a localhost URL, usually `http://127.0.0.1:5173/`.

- [ ] **Step 4: Manual modal inspection**

Open app in browser/Tauri dev surface and verify:

- Settings modal opens with left sidebar, search, right content, close button.
- Search for `ollama`, `whisper`, `prompt`, and `delete` filters nav to backed tabs.
- Advanced remains visible while searching.
- Light and dark theme both use semantic surfaces with readable text.
- Narrow desktop width keeps nav/content usable without overflow.

- [ ] **Step 5: Manual Advanced view inspection**

Click Advanced in settings sidebar. Verify:

- Modal closes.
- Chat workspace content changes to Advanced Settings full-height view.
- Back button restores normal chat.
- Current conversation and unsent composer input remain available after back.
- Dev tools show only when `useDevStore` dev mode is active.

- [ ] **Step 6: Stop dev server**

Stop the dev server with `Ctrl-C`.

- [ ] **Step 7: Check git diff**

Run: `git diff --stat`

Expected: only settings, command palette, app wiring, and tests changed.

- [ ] **Step 8: Commit fixups**

If verification changed files:

```bash
git add <changed-files>
git commit -m "fix(settings): address settings verification"
```

If no files changed, do not create an empty commit.
