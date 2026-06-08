import { useEffect, useMemo, useState } from "react";
import { Box, Chip, InputBase, Typography } from "@mui/material";
import { Check, ChevronDown, Folder, FolderPlus, FolderX, Search, Shield, ShieldAlert, ShieldCheck } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { listAgentWorkspaces } from "./agentClient";
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
    description: "Unrestricted access to the selected workspace and approved runtime capabilities.",
    icon: Shield,
  },
];

export function AgentComposerControls({
  disabled,
  chatId,
}: {
  disabled?: boolean;
  chatId?: string | null;
}) {
  const { permissionPreset, workspaceSelections, workspaces, actions } = useAgentStore();
  const [query, setQuery] = useState("");
  const selectedSelection = chatId ? workspaceSelections[chatId] : undefined;
  const selectedWorkspace =
    selectedSelection?.type === "project"
      ? workspaces.find((workspace) => workspace.id === selectedSelection.projectId || workspace.path === selectedSelection.path)
      : null;
  const selectedPreset = PRESETS.find((preset) => preset.value === permissionPreset) ?? PRESETS[0];
  const SelectedPresetIcon = selectedPreset.icon;
  const filteredWorkspaces = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return workspaces;
    return workspaces.filter((workspace) =>
      [workspace.name, workspace.path].some((value) => value.toLowerCase().includes(needle)),
    );
  }, [query, workspaces]);
  const workspaceLabel =
    selectedSelection?.type === "sandbox"
      ? "Chat sandbox"
      : selectedWorkspace?.name ?? "Select project";

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
        minWidth: 0,
        flexWrap: "wrap",
      }}
    >
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
              color: permissionPreset === "full-access" ? "warning.main" : "text.primary",
              bgcolor: disabled ? "action.disabledBackground" : "action.hover",
              border: "1px solid",
              borderColor: "divider",
              ".MuiChip-icon": { color: "inherit", ml: 1 },
              "&:hover": { bgcolor: "action.selected" },
            }}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sx={{ minWidth: 360, borderRadius: "12px" }}>
          <Typography sx={{ px: 2, pt: 1.25, pb: 0.5, fontSize: 12, color: "text.secondary" }}>
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
                  <Typography sx={{ fontSize: 13, fontWeight: 700 }}>{preset.label}</Typography>
                  <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{preset.description}</Typography>
                </Box>
                {active && <Check size={15} />}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger>
          <Chip
            size="small"
            clickable
            disabled={disabled}
            icon={<Folder size={14} />}
            label={
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, minWidth: 0 }}>
                <Box component="span" sx={{ maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {workspaceLabel}
                </Box>
                <ChevronDown size={12} />
              </Box>
            }
            sx={{
              height: 28,
              borderRadius: "999px",
              color: selectedSelection ? "text.primary" : "error.main",
              bgcolor: disabled ? "action.disabledBackground" : "action.hover",
              border: "1px solid",
              borderColor: selectedSelection ? "divider" : "error.main",
              ".MuiChip-icon": { color: "inherit", ml: 1 },
              "&:hover": { bgcolor: "action.selected" },
            }}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          sx={{
            width: 264,
            borderRadius: "10px",
            p: 0.55,
            bgcolor: "background.paper",
            border: "1px solid",
            borderColor: "divider",
            boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, px: 1, py: 0.7, mb: 0.3 }}>
            <Search size={14} />
            <InputBase
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects"
              autoFocus
              sx={{ flex: 1, fontSize: 13, color: "text.primary", ".MuiInputBase-input": { p: 0 } }}
              inputProps={{ "aria-label": "Search projects" }}
            />
          </Box>
          {filteredWorkspaces.map((workspace) => (
            <DropdownMenuItem
              key={workspace.path}
              onClick={() =>
                chatId &&
                actions.setSelectedWorkspaceSelection(chatId, {
                  type: "project",
                  projectId: workspace.id,
                  path: workspace.path,
                })
              }
              sx={{ minHeight: 32, alignItems: "center", borderRadius: "7px", gap: 1, py: 0.65 }}
            >
              <Folder size={15} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{workspace.name}</Typography>
              </Box>
              {selectedSelection?.type === "project" && selectedSelection.path === workspace.path && <Check size={15} />}
            </DropdownMenuItem>
          ))}
          <Box sx={{ height: 1, bgcolor: "divider", my: 0.35 }} />
          <DropdownMenuItem
            onClick={() => undefined}
            sx={{ minHeight: 32, alignItems: "center", borderRadius: "7px", gap: 1, py: 0.65 }}
          >
            <FolderPlus size={15} />
            <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 700 }}>Add new project</Typography>
            <ChevronDown size={13} />
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() =>
              chatId && actions.setSelectedWorkspaceSelection(chatId, { type: "sandbox", chatId })
            }
            sx={{ minHeight: 32, alignItems: "center", borderRadius: "7px", gap: 1, py: 0.65 }}
          >
            <FolderX size={15} />
            <Typography sx={{ flex: 1, fontSize: 13, fontWeight: 700 }}>Chat sandbox</Typography>
            {selectedSelection?.type === "sandbox" && <Check size={15} />}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

    </Box>
  );
}
