import type { ModelProvider } from "@/store/modelStore";

export type PermissionPreset = "default" | "auto-review" | "full-access";
export type AgentRunStatus =
  | "idle"
  | "running"
  | "waiting_for_approval"
  | "cancelling"
  | "cancelled"
  | "failed"
  | "completed";

export interface AgentWorkspace {
  id: string;
  name: string;
  path: string;
}

export type AgentWorkspaceSelection =
  | { type: "project"; projectId: string; path: string }
  | { type: "sandbox"; chatId: string };

export interface AgentApproval {
  approvalId: string;
  toolName: string;
  risk: string;
  reason?: string;
  path?: string;
  commandPreview?: string;
  diffPreview?: string;
}

export interface AgentEditedFile {
  path: string;
  additions: number;
  deletions: number;
}

export interface AgentChangedFile {
  path: string;
  additions: number;
  deletions: number;
  status: "added" | "modified" | "deleted" | "renamed" | "unknown";
}

export interface AgentFileDiff {
  path: string;
  diff: string;
}

export interface AgentToolCall {
  id: string;
  name: string;
  status: "requested" | "running" | "completed" | "failed";
  output?: string;
  outputDelta?: string;
  isError?: boolean;
  arguments?: Record<string, unknown>;
}

export interface AgentResolvedContext {
  activeWorkspace?: string;
  activeFile?: string;
  recentlyViewedFiles: string[];
  recentlyEditedFiles: string[];
  recentConstraints?: string[];
  lastToolCall?: {
    toolName: string;
    targetPath?: string;
  };
}

export interface AgentActivityItem {
  id: string;
  label: string;
  detail?: string;
  details?: string[];
  status?: "running" | "complete" | "error" | "waiting";
  toolCallId?: string;
  kind:
    | "status"
    | "tool"
    | "reasoning"
    | "approval"
    | "auto_review"
    | "command"
    | "error";
}

export interface AgentDebugEvent {
  eventType: string;
  timestamp: string;
  kind: string;
  value?: unknown;
}

export interface AgentMessageState {
  runId?: string;
  status: AgentRunStatus;
  startedAt: string;
  completedAt?: string;
  request?: {
    prompt: string;
    fileEditRequested: boolean;
    targetFile?: string;
  };
  workspacePath?: string;
  workspaceSelection?: AgentWorkspaceSelection;
  context?: AgentResolvedContext;
  permissionPreset: PermissionPreset;
  activities: AgentActivityItem[];
  toolCalls: Record<string, AgentToolCall>;
  approvals: AgentApproval[];
  editedFiles: AgentEditedFile[];
  debugEvents?: AgentDebugEvent[];
  error?: string;
  responseText?: string;
  respondedStreaming?: boolean;
}

export interface AgentRunStartOptions {
  prompt: string;
  model: string;
  provider: ModelProvider;
  workspacePath?: string;
  workspaceSelection: AgentWorkspaceSelection;
  permissionPreset: PermissionPreset;
  baseUrl?: string | null;
  apiKey?: string | null;
  resolvedContext?: AgentResolvedContext;
  debug?: boolean;
}
