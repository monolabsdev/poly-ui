import { invoke } from "@tauri-apps/api/core";
import type { UnlistenFn } from "@tauri-apps/api/event";
import type { AgentChangedFile, AgentFileDiff, AgentRunStartOptions, AgentWorkspace } from "./types";
import type { AgentUiEvent } from "./generated/AgentUiEvent";
import {
  approveSdkToolCall,
  cancelSdkAgent,
  getSdkRunState,
  listenLocalAgentEvents,
  rejectSdkToolCall,
  startSdkAgent,
} from "./sdkRuntime";

export type AgentRawEvent = AgentUiEvent;

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
  return startSdkAgent(options);
}

export function cancelAgent(runId: string): Promise<void> {
  return cancelSdkAgent(runId);
}

export function approveAgentToolCall(runId: string, approvalId: string): Promise<void> {
  return approveSdkToolCall(runId, approvalId);
}

export function rejectAgentToolCall(runId: string, approvalId: string): Promise<void> {
  return rejectSdkToolCall(runId, approvalId);
}

export type AgentRunStateSnapshot = {
  status: string;
  pending_approval?: { approval_id: string } | null;
};

export function getAgentRunState(runId: string): Promise<AgentRunStateSnapshot> {
  return getSdkRunState(runId);
}

export function listenToAgentEvents(
  callback: (event: AgentRawEvent) => void,
): Promise<UnlistenFn> {
  return Promise.resolve(listenLocalAgentEvents(callback));
}
