import { create } from "zustand";
import type { AgentWorkspace, AgentWorkspaceSelection, PermissionPreset } from "./types";

export type RecentAgentWorkspace = {
  id: string;
  path: string;
  lastUsedAt: number;
};

type AgentStore = {
  enabled: boolean;
  permissionPreset: PermissionPreset;
  workspaceSelections: Record<string, AgentWorkspaceSelection>;
  workspaces: AgentWorkspace[];
  recentWorkspaces: RecentAgentWorkspace[];
  actions: {
    setEnabled: (enabled: boolean) => void;
    setPermissionPreset: (preset: PermissionPreset) => void;
    setSelectedWorkspaceSelection: (chatId: string, selection: AgentWorkspaceSelection) => void;
    clearWorkspaceSelection: (chatId: string) => void;
    setWorkspaces: (workspaces: AgentWorkspace[]) => void;
    addWorkspace: (workspace: AgentWorkspace) => void;
    markWorkspaceUsed: (workspace: AgentWorkspace) => void;
  };
};

const STORAGE_KEY = "poly_agent_workspace_selections";
const RECENT_WORKSPACES_STORAGE_KEY = "poly_agent_recent_workspaces";
const USER_WORKSPACES_STORAGE_KEY = "poly_agent_user_workspaces";
const ENABLED_STORAGE_KEY = "poly_agent_enabled";
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

function loadRecentWorkspaces(): RecentAgentWorkspace[] {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(RECENT_WORKSPACES_STORAGE_KEY) ?? "[]",
    );
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is RecentAgentWorkspace =>
            item &&
            typeof item.id === "string" &&
            typeof item.path === "string" &&
            typeof item.lastUsedAt === "number",
        )
      : [];
  } catch {
    return [];
  }
}

function persistRecentWorkspaces(recentWorkspaces: RecentAgentWorkspace[]) {
  localStorage.setItem(
    RECENT_WORKSPACES_STORAGE_KEY,
    JSON.stringify(recentWorkspaces),
  );
}

function loadUserWorkspaces(): AgentWorkspace[] {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(USER_WORKSPACES_STORAGE_KEY) ?? "[]",
    );
    return Array.isArray(parsed)
      ? parsed.filter(
          (item): item is AgentWorkspace =>
            item &&
            typeof item.id === "string" &&
            typeof item.name === "string" &&
            typeof item.path === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function persistUserWorkspaces(workspaces: AgentWorkspace[]) {
  localStorage.setItem(USER_WORKSPACES_STORAGE_KEY, JSON.stringify(workspaces));
}

function dedupeWorkspaces(workspaces: AgentWorkspace[]) {
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
}

export const useAgentStore = create<AgentStore>((set) => ({
  enabled: localStorage.getItem(ENABLED_STORAGE_KEY) === "true",
  permissionPreset:
    (localStorage.getItem("poly_agent_permission_preset") as PermissionPreset | null) ??
    "default",
  workspaceSelections: loadSelections(),
  workspaces: loadUserWorkspaces(),
  recentWorkspaces: loadRecentWorkspaces(),
  actions: {
    setEnabled: (enabled) => {
      localStorage.setItem(ENABLED_STORAGE_KEY, String(enabled));
      set({ enabled });
    },
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
    setWorkspaces: (workspaces) =>
      set((state) => {
        const mergedWorkspaces = dedupeWorkspaces([
          ...workspaces,
          ...loadUserWorkspaces(),
        ]);
        const available = new Set(
          mergedWorkspaces.flatMap((workspace) => [workspace.id, workspace.path]),
        );
        const recentWorkspaces = state.recentWorkspaces.filter(
          (workspace) =>
            available.has(workspace.id) || available.has(workspace.path),
        );
        persistRecentWorkspaces(recentWorkspaces);
        return { workspaces: mergedWorkspaces, recentWorkspaces };
      }),
    addWorkspace: (workspace) =>
      set((state) => {
        const userWorkspaces = dedupeWorkspaces([
          workspace,
          ...loadUserWorkspaces(),
        ]);
        persistUserWorkspaces(userWorkspaces);
        return {
          workspaces: dedupeWorkspaces([workspace, ...state.workspaces]),
        };
      }),
    markWorkspaceUsed: (workspace) =>
      set((state) => {
        const recentWorkspaces = [
          { id: workspace.id, path: workspace.path, lastUsedAt: Date.now() },
          ...state.recentWorkspaces.filter(
            (item) => item.id !== workspace.id && item.path !== workspace.path,
          ),
        ].slice(0, 12);
        persistRecentWorkspaces(recentWorkspaces);
        return { recentWorkspaces };
      }),
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
