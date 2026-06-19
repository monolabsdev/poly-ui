import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type { AgentChangedFile, AgentFileDiff, AgentRunStartOptions, AgentWorkspace } from "./types";
import type { AgentRunInput } from "./generated/AgentRunInput";
import type { AgentUiEvent } from "./generated/AgentUiEvent";

export type AgentRawEvent = AgentUiEvent;

const DEFAULT_RUNTIME_LIMITS: AgentRunInput["limits"] = {
  max_steps: 8,
  max_file_read_bytes: 256 * 1024,
  max_tool_output_bytes: 64 * 1024,
  max_search_results: 50,
  max_context_messages: 32,
  command_timeout_secs: 60,
};

export async function listAgentWorkspaces(): Promise<AgentWorkspace[]> {
  return invoke<AgentWorkspace[]>("agent_list_workspaces");
}

export async function pickAgentWorkspace(): Promise<AgentWorkspace | null> {
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({
    directory: true,
    multiple: false,
    title: "Select project folder",
  });
  if (!selected || Array.isArray(selected)) return null;
  const path = selected.replace(/\\/g, "/");
  const parts = path.split("/").filter(Boolean);
  const name = parts[parts.length - 1] ?? path;
  return { id: path, name, path: selected };
}

export async function getAgentChangedFiles(workspacePath: string): Promise<AgentChangedFile[]> {
  return invoke<AgentChangedFile[]>("agent_changed_files", { workspacePath });
}

export async function getAgentFileDiff(workspacePath: string, path: string): Promise<AgentFileDiff> {
  return invoke<AgentFileDiff>("agent_file_diff", { workspacePath, path });
}

export function deleteAgentChatSandbox(chatId: string): Promise<void> {
  return invoke("agent_delete_chat_sandbox", { chatId });
}

export async function runAgent(options: AgentRunStartOptions): Promise<string> {
  const provider =
    options.provider === "OpenAICompatible"
      ? "OpenAICompatible"
      : "Ollama";
  const input: AgentRunInput = {
    prompt: options.prompt,
    workspace_path: options.workspacePath ?? null,
    workspace_selection: toBackendWorkspaceSelection(options.workspaceSelection),
    limits: DEFAULT_RUNTIME_LIMITS,
    permission_preset: options.permissionPreset,
    resolved_context: options.resolvedContext
      ? {
          active_workspace: options.resolvedContext.activeWorkspace ?? null,
          active_file: options.resolvedContext.activeFile ?? null,
          recently_viewed_files: options.resolvedContext.recentlyViewedFiles,
          recently_edited_files: options.resolvedContext.recentlyEditedFiles,
          recent_constraints: options.resolvedContext.recentConstraints ?? [],
          last_tool_call: options.resolvedContext.lastToolCall
            ? {
                tool_name: options.resolvedContext.lastToolCall.toolName,
                target_path: options.resolvedContext.lastToolCall.targetPath ?? null,
              }
            : null,
        }
      : null,
    model: {
      provider,
      model: options.model,
      base_url: options.baseUrl ?? null,
      api_key: options.apiKey ?? null,
    },
    debug: options.debug ?? false,
  };

  return invoke<string>("agent_run", {
    input,
  });
}

function toBackendWorkspaceSelection(
  selection: AgentRunStartOptions["workspaceSelection"],
): AgentRunInput["workspace_selection"] {
  if (selection.type === "project") {
    return {
      type: "project",
      project_id: selection.projectId,
      path: selection.path,
    };
  }
  return {
    type: "sandbox",
    chat_id: selection.chatId,
  };
}

export function cancelAgent(runId: string): Promise<void> {
  return invoke("agent_cancel", { runId });
}

export function approveAgentToolCall(runId: string, approvalId: string): Promise<void> {
  return invoke("agent_approve_tool_call", { runId, approvalId });
}

export function rejectAgentToolCall(runId: string, approvalId: string): Promise<void> {
  return invoke("agent_reject_tool_call", { runId, approvalId });
}

export type AgentRunStateSnapshot = {
  status: string;
  pending_approval?: { approval_id: string } | null;
};

export function getAgentRunState(runId: string): Promise<AgentRunStateSnapshot> {
  return invoke<AgentRunStateSnapshot>("agent_get_run_state", { runId });
}

export function listenToAgentEvents(
  callback: (event: AgentRawEvent) => void,
): Promise<UnlistenFn> {
  return listen<AgentRawEvent>("poly-agent:event", (event) => callback(event.payload));
}
