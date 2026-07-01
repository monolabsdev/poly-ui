import { useEffect, useMemo, useRef, useState } from "react";
import { Box } from "@/components/ui/Box";
import { ButtonBase } from "@/components/ui/button-base";
import { Chip } from "@/components/ui/chip";
import { InputBase } from "@/components/ui/input-base";
import { Typography } from "@/components/ui/Typography";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderPlus,
  FolderX,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listAgentWorkspaces, pickAgentWorkspace } from "./agentClient";
import { useAgentStore } from "./agentStore";
import type { PermissionPreset } from "./types";

const PRESETS: Array<{
  value: PermissionPreset;
  label: string;
  description: string;
  icon: typeof Shield;
}> = [
  {
    value: "default",
    label: "Ask",
    description: "Always ask before risky actions.",
    icon: ShieldAlert,
  },
  {
    value: "auto-review",
    label: "Auto",
    description: "Only ask for actions detected as potentially unsafe.",
    icon: ShieldCheck,
  },
  {
    value: "full-access",
    label: "Full access",
    description:
      "Unrestricted access to the selected workspace and approved runtime capabilities.",
    icon: Shield,
  },
];

export function AgentComposerControls({
  disabled,
  chatId,
  mode = "all",
}: {
  disabled?: boolean;
  chatId?: string | null;
  mode?: "all" | "permission" | "workspace";
}) {
  const permissionPreset = useAgentStore((state) => state.permissionPreset);
  const workspaceSelections = useAgentStore((state) => state.workspaceSelections);
  const workspaces = useAgentStore((state) => state.workspaces);
  const recentWorkspaces = useAgentStore((state) => state.recentWorkspaces);
  const actions = useAgentStore((state) => state.actions);
  const [query, setQuery] = useState("");
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectedSelection = chatId ? workspaceSelections[chatId] : undefined;
  const selectedWorkspace =
    selectedSelection?.type === "project"
      ? workspaces.find(
          (workspace) =>
            workspace.id === selectedSelection.projectId ||
            workspace.path === selectedSelection.path,
        )
      : null;
  const selectedPreset =
    PRESETS.find((preset) => preset.value === permissionPreset) ?? PRESETS[0];
  const SelectedPresetIcon = selectedPreset.icon;
  const dedupedWorkspaces = useMemo(() => {
    const seenIds = new Set<string>();
    const seenPaths = new Set<string>();
    return workspaces.filter((workspace) => {
      if (!workspace.id || !workspace.path) return false;
      if (seenIds.has(workspace.id) || seenPaths.has(workspace.path)) {
        return false;
      }
      seenIds.add(workspace.id);
      seenPaths.add(workspace.path);
      return true;
    });
  }, [workspaces]);
  const recentWorkspaceList = useMemo(() => {
    const byKey = new Map<string, (typeof workspaces)[number]>();
    for (const workspace of dedupedWorkspaces) {
      byKey.set(workspace.id, workspace);
      byKey.set(workspace.path, workspace);
    }
    const seen = new Set<string>();
    return [...recentWorkspaces]
      .sort((a, b) => b.lastUsedAt - a.lastUsedAt)
      .map((recent) => byKey.get(recent.id) ?? byKey.get(recent.path))
      .filter((workspace): workspace is (typeof workspaces)[number] => {
        if (!workspace) return false;
        const key = workspace.id || workspace.path;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 2);
  }, [dedupedWorkspaces, recentWorkspaces, workspaces]);
  const visibleWorkspaces = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return recentWorkspaceList;
    return dedupedWorkspaces.filter((workspace) =>
      [workspace.name, workspace.path].some((value) =>
        value.toLowerCase().includes(needle),
      ),
    );
  }, [dedupedWorkspaces, query, recentWorkspaceList]);
  const workspaceLabel =
    selectedSelection?.type === "sandbox"
      ? "No project"
      : (selectedWorkspace?.name ?? "Select project");

  const selectWorkspace = (workspace: (typeof workspaces)[number]) => {
    if (!chatId) return;
    actions.setSelectedWorkspaceSelection(chatId, {
      type: "project",
      projectId: workspace.id,
      path: workspace.path,
    });
    actions.markWorkspaceUsed(workspace);
    setWorkspaceOpen(false);
  };

  const selectSandbox = () => {
    if (!chatId) return;
    actions.setSelectedWorkspaceSelection(chatId, {
      type: "sandbox",
      chatId,
    });
    setWorkspaceOpen(false);
  };

  const handleWorkspaceKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const items = Array.from(
      document.querySelectorAll<HTMLElement>("[data-workspace-menu-item]"),
    );
    const target = event.key === "ArrowDown" ? items[0] : items[items.length - 1];
    requestAnimationFrame(() => {
      requestAnimationFrame(() => target?.focus());
    });
  };

  useEffect(() => {
    if (workspaces.length) return;
    listAgentWorkspaces()
      .then(actions.setWorkspaces)
      .catch(() => actions.setWorkspaces([]));
  }, [actions, workspaces.length]);

  return (
    <Box
    >
      {(mode === "all" || mode === "permission") && (
        <DropdownMenu>
          <DropdownMenuTrigger>
            <Chip
              size="small"
              clickable
              disabled={disabled}
              icon={<SelectedPresetIcon size={14} />}
              label={
                <Box className="flex items-center gap-1 whitespace-nowrap">
                  {selectedPreset.label}
                  <ChevronDown size={12} />
                </Box>
              }
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
          >
            {PRESETS.map((preset) => {
              const Icon = preset.icon;
              const active = preset.value === permissionPreset;
              return (
                <DropdownMenuItem
                  key={preset.value}
                  onClick={() => actions.setPermissionPreset(preset.value)}
                >
                  <Icon size={16} />
                  <Box>
                    <Typography>
                      {preset.label}
                    </Typography>
                    <Typography>
                      {preset.description}
                    </Typography>
                  </Box>
                  {active && <Check size={15} />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {(mode === "all" || mode === "workspace") && (
        <DropdownMenu
          open={workspaceOpen}
          onOpenChange={(open) => {
            setWorkspaceOpen(open);
            if (!open) setQuery("");
          }}
        >
          <DropdownMenuTrigger>
            <Chip
              size="small"
              clickable
              disabled={disabled}
              icon={<Folder size={14} />}
              label={
                <Box className="flex items-center gap-1 whitespace-nowrap">
                  <Box as="span">{workspaceLabel}</Box>
                  <ChevronDown size={12} />
                </Box>
              }
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
          >
            <Box
              className="flex items-center gap-2 rounded-xl px-2 py-1.5"
              onKeyDown={handleWorkspaceKeyDown}
            >
              <Search size={13} className="shrink-0 text-muted-foreground" />
              <InputBase
                inputRef={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search projects"
                autoFocus
                inputProps={{ "aria-label": "Search projects" }}
              />
            </Box>
            {visibleWorkspaces.map((workspace) => (
              <ProjectMenuRow
                key={workspace.path}
                icon={<Folder size={14} />}
                label={workspace.name}
                selected={
                  selectedSelection?.type === "project" &&
                  selectedSelection.path === workspace.path
                }
                onClick={() => selectWorkspace(workspace)}
              />
            ))}
            <ProjectMenuRow
              icon={<FolderPlus size={14} />}
              label="Add new project"
              trailing={<ChevronRight size={13} />}
              onClick={async () => {
                const workspace = await pickAgentWorkspace();
                if (!workspace) {
                  requestAnimationFrame(() => {
                    requestAnimationFrame(() => searchRef.current?.focus());
                  });
                  return;
                }
                actions.addWorkspace(workspace);
                if (chatId) {
                  actions.setSelectedWorkspaceSelection(chatId, {
                    type: "project",
                    projectId: workspace.id,
                    path: workspace.path,
                  });
                  actions.markWorkspaceUsed(workspace);
                }
                setWorkspaceOpen(false);
              }}
            />
            <ProjectMenuRow
              icon={<FolderX size={14} />}
              label="Don't work in a project"
              selected={selectedSelection?.type === "sandbox"}
              onClick={selectSandbox}
            />
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </Box>
  );
}

function ProjectMenuRow({
  icon,
  label,
  selected,
  trailing,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  selected?: boolean;
  trailing?: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <ButtonBase
      data-workspace-menu-item
      className="group/dropdown-menu-item relative flex w-full min-h-7 cursor-default items-center gap-2 rounded-xl px-2 py-1.5 text-sm outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
      onKeyDown={(event: React.KeyboardEvent<HTMLElement>) => {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        const items = Array.from(
          document.querySelectorAll<HTMLElement>("[data-workspace-menu-item]"),
        );
        const index = items.indexOf(event.currentTarget);
        const offset = event.key === "ArrowDown" ? 1 : -1;
        const next = items[(index + offset + items.length) % items.length];
        requestAnimationFrame(() => {
          requestAnimationFrame(() => next?.focus());
        });
      }}
      onClick={(event: React.MouseEvent<HTMLElement>) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <Box className="flex shrink-0 items-center text-muted-foreground">
        {icon}
      </Box>
      <Typography className="min-w-0 flex-1 truncate">
        {label}
      </Typography>
      <Box className="flex shrink-0 items-center">
        {selected ? <Check size={14} strokeWidth={2.4} /> : trailing}
      </Box>
    </ButtonBase>
  );
}
