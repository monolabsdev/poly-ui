import { useEffect, useMemo, useRef, useState } from "react";
import { Box, ButtonBase, Chip, InputBase, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
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
    label: "Ask for approval",
    description: "Always ask before risky actions.",
    icon: ShieldAlert,
  },
  {
    value: "auto-review",
    label: "Approve for me",
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
  const { permissionPreset, workspaceSelections, workspaces, recentWorkspaces, actions } =
    useAgentStore();
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
    target?.focus();
  };

  useEffect(() => {
    if (workspaces.length) return;
    listAgentWorkspaces()
      .then(actions.setWorkspaces)
      .catch(() => actions.setWorkspaces([]));
  }, [actions, workspaces.length]);

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.75,
        width: "auto",
        minWidth: 0,
        flexWrap: "wrap",
      }}
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
                <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                  {selectedPreset.label}
                  <ChevronDown size={12} />
                </Box>
              }
              sx={{
                height: 28,
                borderRadius: "999px",
                color:
                  permissionPreset === "full-access"
                    ? "warning.main"
                    : "text.primary",
                bgcolor: disabled
                  ? "action.disabledBackground"
                  : "action.hover",
                border: "1px solid",
                borderColor: "divider",
                ".MuiChip-icon": { color: "inherit", ml: 1 },
                "&:hover": { bgcolor: "action.selected" },
              }}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sx={{ minWidth: 360, borderRadius: "12px" }}
          >
            <Typography
              sx={{
                px: 2,
                pt: 1.25,
                pb: 0.5,
                fontSize: 12,
                color: "text.secondary",
              }}
            >
              How should actions be approved?
            </Typography>
            {PRESETS.map((preset) => {
              const Icon = preset.icon;
              const active = preset.value === permissionPreset;
              return (
                <DropdownMenuItem
                  key={preset.value}
                  onClick={() => actions.setPermissionPreset(preset.value)}
                  sx={{ alignItems: "flex-start", borderRadius: "10px", py: 1 }}
                >
                  <Icon size={16} />
                  <Box sx={{ flex: 1 }}>
                    <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
                      {preset.label}
                    </Typography>
                    <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
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
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                    minWidth: 0,
                  }}
                >
                  <Box
                    component="span"
                    sx={{
                      maxWidth: 160,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {workspaceLabel}
                  </Box>
                  <ChevronDown size={12} />
                </Box>
              }
              sx={{
                height: mode === "workspace" ? 26 : 28,
                maxWidth: { xs: 220, sm: 280 },
                borderRadius: mode === "workspace" ? "8px" : "999px",
                color: selectedSelection
                  ? mode === "workspace"
                    ? "text.secondary"
                    : "text.primary"
                  : "error.main",
                bgcolor: disabled
                  ? "action.disabledBackground"
                  : mode === "workspace"
                    ? "transparent"
                    : "action.hover",
                border: "1px solid",
                borderColor: selectedSelection
                  ? mode === "workspace"
                    ? "transparent"
                    : "divider"
                  : "error.main",
                px: mode === "workspace" ? 0.25 : 0,
                ".MuiChip-icon": {
                  color: "inherit",
                  ml: mode === "workspace" ? 0.5 : 1,
                },
                ".MuiChip-label": {
                  minWidth: 0,
                  px: mode === "workspace" ? 0.5 : undefined,
                },
                "&:hover": {
                  bgcolor:
                    mode === "workspace" ? "action.hover" : "action.selected",
                },
              }}
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            sx={{
              width: 260,
              minWidth: 260,
              maxWidth: 260,
              borderRadius: "10px",
              p: "6px",
              bgcolor: "background.paper",
              border: "1px solid",
              borderColor: "border.light",
              boxShadow: (theme) => `0 8px 24px ${alpha(theme.palette.common.black, 0.35)}`,
              color: "text.primary",
              ".MuiList-root": { p: 0 },
            }}
          >
            <Box
              onKeyDown={handleWorkspaceKeyDown}
              sx={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                height: 32,
                px: "10px",
                color: "text.disabled",
              }}
            >
              <Search size={13} />
              <InputBase
                inputRef={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search projects"
                autoFocus
                  sx={{
                    flex: 1,
                    fontSize: 13,
                    color: "text.primary",
                    fontWeight: 500,
                    ".MuiInputBase-input": {
                      height: 32,
                      p: 0,
                      "&::placeholder": {
                        color: "text.disabled",
                        opacity: 1,
                      },
                    },
                  }}
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
                  searchRef.current?.focus();
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
      onKeyDown={(event) => {
        if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
        event.preventDefault();
        const items = Array.from(
          document.querySelectorAll<HTMLElement>("[data-workspace-menu-item]"),
        );
        const index = items.indexOf(event.currentTarget);
        const offset = event.key === "ArrowDown" ? 1 : -1;
        const next = items[(index + offset + items.length) % items.length];
        next?.focus();
      }}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      sx={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        minHeight: 34,
        height: 34,
        px: "10px",
        my: "1px",
        gap: "9px",
        borderRadius: "6px",
        color: "text.primary",
        textAlign: "left",
        outline: 0,
        "&:hover, &.Mui-focusVisible": {
          bgcolor: "action.hover",
        },
      }}
    >
      <Box
        sx={{
          width: 16,
          height: 16,
          display: "grid",
          placeItems: "center",
          color: "text.disabled",
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Typography
        sx={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontSize: 13,
          fontWeight: 500,
          color: "inherit",
          lineHeight: 1.2,
          letterSpacing: 0,
        }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          width: 16,
          height: 16,
          display: "grid",
          placeItems: "center",
          color: selected ? "success.main" : "text.disabled",
          flexShrink: 0,
        }}
      >
        {selected ? <Check size={14} strokeWidth={2.4} /> : trailing}
      </Box>
    </ButtonBase>
  );
}
