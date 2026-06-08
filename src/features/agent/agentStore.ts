import { create } from "zustand";
import type { AgentWorkspace, AgentWorkspaceSelection, PermissionPreset } from "./types";

type AgentStore = {
  enabled: boolean;
  permissionPreset: PermissionPreset;
  workspaceSelections: Record<string, AgentWorkspaceSelection>;
  workspaces: AgentWorkspace[];
  actions: {
    setEnabled: (enabled: boolean) => void;
    setPermissionPreset: (preset: PermissionPreset) => void;
    setSelectedWorkspaceSelection: (chatId: string, selection: AgentWorkspaceSelection) => void;
    clearWorkspaceSelection: (chatId: string) => void;
    setWorkspaces: (workspaces: AgentWorkspace[]) => void;
  };
};

const STORAGE_KEY = "poly_agent_workspace_selections";
export const DRAFT_WORKSPACE_SELECTION_CHAT_ID = "__draft__";

function loadSelections(): Record<string, AgentWorkspaceSelection> {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistSelections(selections: Record<string, AgentWorkspaceSelection>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
}

export const useAgentStore = create<AgentStore>((set) => ({
  enabled: false,
  permissionPreset:
    (localStorage.getItem("poly_agent_permission_preset") as PermissionPreset | null) ??
    "default",
  workspaceSelections: loadSelections(),
  workspaces: [],
  actions: {
    setEnabled: (enabled) => set({ enabled }),
    setPermissionPreset: (permissionPreset) => {
      localStorage.setItem("poly_agent_permission_preset", permissionPreset);
      set({ permissionPreset });
    },
    setSelectedWorkspaceSelection: (chatId, selection) =>
      set((state) => {
        const workspaceSelections = { ...state.workspaceSelections, [chatId]: selection };
        persistSelections(workspaceSelections);
        return { workspaceSelections };
      }),
    clearWorkspaceSelection: (chatId) =>
      set((state) => {
        const workspaceSelections = { ...state.workspaceSelections };
        delete workspaceSelections[chatId];
        persistSelections(workspaceSelections);
        return { workspaceSelections };
      }),
    setWorkspaces: (workspaces) => set({ workspaces }),
  },
}));

export function defaultWorkspaceSelection(
  workspaces: AgentWorkspace[],
): AgentWorkspaceSelection | null {
  const workspace =
    workspaces.find((item) => item.name === "poly-ui") ??
    workspaces.find((item) => item.name === "monolabs") ??
    workspaces[0];
  return workspace
    ? { type: "project", projectId: workspace.id, path: workspace.path }
    : null;
}
