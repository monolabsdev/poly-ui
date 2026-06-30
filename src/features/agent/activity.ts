import type {
  AgentActivityItem,
  AgentApproval,
  AgentEditedFile,
  AgentMessageState,
  AgentToolCall,
} from "./types";
import type { AgentRawEvent } from "./agentClient";
import type { AgentUiEventPayload } from "./generated/AgentUiEventPayload";

const PHASE_ORDER: Record<string, number> = {
  run: 0,
  thinking: 10,
  workspace_inspection: 20,
  file_search: 30,
  file_read: 40,
  editing: 50,
  verifying: 60,
  summarizing: 70,
  responding: 80,
  completed: 90,
  failed: 100,
  cancelled: 110,
};

const TOOL_PHASES = new Set([
  "workspace_inspection",
  "file_search",
  "file_read",
  "editing",
  "verifying",
]);

export function appendAgentEvent(
  state: AgentMessageState,
  event: AgentRawEvent,
): AgentMessageState {
  const kind = event.data.kind;
  const value = eventValue(event.data);
  const next: AgentMessageState = {
    ...state,
    context: state.context
      ? {
          ...state.context,
          recentlyViewedFiles: [...state.context.recentlyViewedFiles],
          recentlyEditedFiles: [...state.context.recentlyEditedFiles],
          recentConstraints: [...(state.context.recentConstraints ?? [])],
          lastToolCall: state.context.lastToolCall ? { ...state.context.lastToolCall } : undefined,
        }
      : {
          activeWorkspace: state.workspacePath,
          recentlyViewedFiles: [],
          recentlyEditedFiles: [],
          recentConstraints: [],
        },
    activities: [...state.activities],
    approvals: [...state.approvals],
    editedFiles: [...state.editedFiles],
    debugEvents: [
      ...(state.debugEvents ?? []),
      {
        eventType: event.event_type,
        timestamp: event.timestamp,
        kind,
        value,
      },
    ].slice(-200),
    toolCalls: { ...state.toolCalls },
  };

  switch (kind) {
    case "started":
      next.status = "running";
      next.responseText = "";
      next.respondedStreaming = false;
      upsertActivity(next, "run", activity("status", "Starting", "Preparing agent run.", "running", "run"));
      break;
    case "thinking":
      completeEarlierRunningPhases(next, "thinking");
      upsertActivity(next, "thinking", activity("reasoning", "Thinking", "Choosing the next action.", "running", "thinking"));
      break;
    case "activity":
      if (!safeSummary(value.title) && !safeSummary(value.summary) && !safeDetails(value.details)?.length) {
        break;
      }
      completeEarlierRunningPhases(next, activityKey(value.phase, value.title));
      upsertActivity(
        next,
        activityKey(value.phase, value.title),
        activity(
          kindForPhase(value.phase),
          safeSummary(value.title) || "Working",
          safeSummary(value.summary),
          activityStatus(value.status),
          activityKey(value.phase, value.title),
          safeDetails(value.details),
        ),
      );
      break;
    case "model_call_started": {
      const thinkingSummary = next.activities.some(a => a.toolCallId && ["workspace_inspection", "file_read", "file_search", "editing"].includes(a.toolCallId))
        ? "Preparing the final response from the gathered information."
        : next.request?.fileEditRequested
          ? "Understanding the requested change and locating the target file."
          : "Understanding the request before choosing the next action.";
      const phase = next.activities.some(a => a.toolCallId && TOOL_PHASES.has(a.toolCallId))
        ? "summarizing"
        : "thinking";
      completeEarlierRunningPhases(next, phase);
      upsertActivity(next, phase, activity("reasoning", labelForPhase(phase), thinkingSummary, "running", phase));
      break;
    }
    case "model_call_finished":
      completeActivity(next, "thinking", "complete");
      completeActivity(next, "summarizing", "complete");
      break;
    case "tool_call_requested":
      next.toolCalls[value.tool_call_id] = {
        id: value.tool_call_id,
        name: value.tool_name,
        status: "requested",
        arguments: value.arguments,
      };
      updateContextFromTool(next, value.tool_name, value.arguments);
      completeEarlierRunningPhases(next, phaseForTool(value.tool_name));
      upsertActivity(
        next,
        phaseForTool(value.tool_name),
        activity(
          toolKind(value.tool_name),
          labelForTool(value.tool_name),
          plannedSummaryForTool(value.tool_name, value.arguments),
          "running",
          phaseForTool(value.tool_name),
          detailForTool(value.tool_name, value.arguments),
        ),
      );
      break;
    case "tool_call_started":
      next.toolCalls[value.tool_call_id] = {
        ...(next.toolCalls[value.tool_call_id] ?? {
          id: value.tool_call_id,
          name: value.tool_name,
        }),
        status: "running",
      };
      break;
    case "tool_call_delta": {
      const call = next.toolCalls[value.tool_call_id];
      if (call) {
        next.toolCalls[value.tool_call_id] = {
          ...call,
          outputDelta: `${call.outputDelta ?? ""}${value.delta ?? ""}`,
        };
      }
      break;
    }
    case "text_delta": {
      const text = typeof value?.text === "string" ? value.text : "";
      if (text) {
        const mode = value?.mode;
        next.responseText = mode === "snapshot" ? text : (next.responseText ?? "") + text;
        next.respondedStreaming = true;
      }
      break;
    }
    case "step_limit_reached":
      completeAllRunning(next, "complete");
      upsertActivity(
        next,
        "summarizing",
        activity("reasoning", "Step limit reached", `Stopped after ${value.max_steps} steps.`, "complete", "summarizing"),
      );
      break;
    case "unknown_tool_requested":
      upsertActivity(
        next,
        `unknown_tool:${value.tool_name}`,
        activity("error", "Unknown tool requested", value.tool_name, "error", `unknown_tool:${value.tool_name}`),
      );
      break;
    case "final_response_delta": {
      const text = typeof value?.text === "string" ? value.text : "";
      if (text) {
        next.responseText = text;
        next.respondedStreaming = true;
        completeEarlierRunningPhases(next, "responding");
        upsertActivity(next, "responding", activity("reasoning", "Responding", "Receiving the model response.", "running", "responding"));
      }
      break;
    }
    case "tool_call_finished": {
      const prev = next.toolCalls[value.tool_call_id];
      const call: AgentToolCall = {
        ...(prev ?? { id: value.tool_call_id, name: "tool" }),
        status: value.is_error ? "failed" : "completed",
        output: value.output,
        isError: value.is_error,
      };
      next.toolCalls[value.tool_call_id] = call;
      completeActivity(next, value.tool_call_id, value.is_error ? "error" : "complete");
      const edited = editedFileFromTool(call);
      if (edited) mergeEditedFile(next, edited);
      if (!call.isError) updateContextFromTool(next, call.name, call.arguments);
      completeActivity(next, phaseForTool(call.name), value.is_error ? "error" : "complete");
      break;
    }
    case "approval_required": {
      next.status = "waiting_for_approval";
      const approval: AgentApproval = {
        approvalId: value.approval_id,
        toolName: value.tool_name,
        risk: String(value.risk ?? "requires approval"),
        reason: value.reason,
        path: value.path,
        commandPreview: value.command_preview,
        diffPreview: value.diff_preview,
      };
      next.approvals = [
        ...next.approvals.filter((item) => item.approvalId !== approval.approvalId),
        approval,
      ];
      next.activities.push(
        activity("approval", "Waiting for approval", approval.reason ?? approval.toolName, "waiting"),
      );
      break;
    }
    case "tool_auto_approved":
      next.activities.push(activity("auto_review", "Approved automatically", friendlyApprovalReason(value.reason), "complete"));
      break;
    case "tool_auto_denied":
      next.activities.push(activity("auto_review", "Denied automatically", value.reason, "error"));
      break;
    case "auto_review_decision":
      next.activities.push(
        activity(
          "auto_review",
          "Reviewed action",
          friendlyReviewDecision(value.decision, value.reason),
          "complete",
        ),
      );
      break;
    case "finished": {
      completeAllRunning(next, "complete");
      next.status = "completed";
      next.completedAt = event.timestamp;
      const finishText = typeof value?.text === "string" ? value.text : "";
      if (next.respondedStreaming || finishText) {
        upsertActivity(next, "responding", activity("reasoning", "Responding", "Response complete.", "complete", "responding"));
      }
      if (finishText) {
        next.responseText = reconcileText(next.responseText ?? "", finishText);
      }
      break;
    }
    case "failed":
      next.status = "failed";
      next.completedAt = event.timestamp;
      next.error = value.error;
      completeAllRunning(next, "error");
      upsertActivity(next, "failed", activity("error", "Run failed", value.error, "error", "failed"));
      break;
    case "cancelled":
      next.status = "cancelled";
      next.completedAt = event.timestamp;
      upsertActivity(next, "cancelled", activity("status", "Cancelled", "Stopped the agent run.", "complete", "cancelled"));
      break;
    default:
      break;
  }

  if (next.status !== "waiting_for_approval" && kind !== "approval_required") {
    next.approvals = next.approvals.filter((approval) => {
      const call = next.toolCalls[approval.approvalId];
      return !call || call.status === "requested" || call.status === "running";
    });
  }

  return next;
}

function eventValue(data: AgentUiEventPayload): Record<string, any> {
  return "value" in data && data.value && typeof data.value === "object" ? data.value : {};
}

function updateContextFromTool(
  state: AgentMessageState,
  toolName: string,
  args?: Record<string, unknown>,
) {
  const path = typeof args?.path === "string" ? args.path.replace(/\\/g, "/") : undefined;
  if (!path || !state.context) return;
  state.context.activeFile = path;
  state.context.lastToolCall = { toolName, targetPath: path };
  if (toolName === "read_file") pushUnique(state.context.recentlyViewedFiles, path);
  if (toolName === "apply_patch" || toolName === "write_file") {
    pushUnique(state.context.recentlyEditedFiles, path);
  }
}

function activity(
  kind: AgentActivityItem["kind"],
  label: string,
  detail?: string,
  status?: AgentActivityItem["status"],
  toolCallId?: string,
  details?: string[],
): AgentActivityItem {
  const id = toolCallId || `phase_${kind}_${label}_${crypto.randomUUID().slice(0, 8)}`;
  return { id, kind, label, detail, details: addUniqueDetails(undefined, details), status, toolCallId };
}

function upsertActivity(state: AgentMessageState, key: string, item: AgentActivityItem) {
  const index = state.activities.findIndex((existing) => existing.toolCallId === key);
  if (index >= 0) {
    const details = mergeDetails(state.activities[index].details, item.details, item.detail);
    state.activities[index] = {
      ...state.activities[index],
      ...item,
      id: state.activities[index].id,
      toolCallId: key,
      details,
      detail: item.detail ?? state.activities[index].detail,
    };
    normalizeActivityOrder(state);
    return;
  }
  state.activities.push({ ...item, toolCallId: key, details: mergeDetails(undefined, item.details, item.detail) });
  normalizeActivityOrder(state);
}

function activityStatus(value: unknown): AgentActivityItem["status"] {
  if (value === "completed") return "complete";
  if (value === "failed") return "error";
  if (value === "waiting") return "waiting";
  return "running";
}

function safeSummary(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return value
    .replace(/<\|fim_[^>]+?\|>/g, "")
    .replace(/functions\.[a-z_]+/gi, "tool")
    .replace(/[{}][\s\S]*[{}]/g, "")
    .trim() || undefined;
}

function safeDetails(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const details = value
    .map((item) => safeSummary(item))
    .filter((item): item is string => Boolean(item));
  return details.length ? details : undefined;
}

function mergeDetails(
  existing?: string[],
  incoming?: string[],
  detail?: string,
): string[] | undefined {
  return addUniqueDetails(existing, [...(incoming ?? []), detail].filter(Boolean) as string[]);
}

export function addUniqueDetail(existing: string[] | undefined, nextDetail: string | undefined): string[] | undefined {
  return addUniqueDetails(existing, nextDetail ? [nextDetail] : []);
}

function addUniqueDetails(existing: string[] | undefined, incoming: string[] | undefined): string[] | undefined {
  const merged = [...(existing ?? [])];
  const keys = new Set(merged.map(detailKey));
  for (const raw of incoming ?? []) {
    const item = safeSummary(raw);
    if (!item) continue;
    const key = detailKey(item);
    if (keys.has(key)) continue;
    keys.add(key);
    merged.push(item);
  }
  return merged.length ? merged.slice(-8) : undefined;
}

function detailKey(value: string): string {
  return value.trim().toLowerCase().replace(/[.!?…]+$/g, "").replace(/\s+/g, " ");
}

function activityKey(phase: unknown, title: unknown): string {
  const raw = typeof phase === "string" && phase ? phase : String(title ?? crypto.randomUUID());
  if (raw === "context_loading" || raw === "file_read") return "file_read";
  if (raw === "workspace" || raw === "workspace_inspection") return "workspace_inspection";
  if (raw === "file_search" || raw === "searching_files") return "file_search";
  if (raw === "file_edit" || raw === "editing") return "editing";
  if (raw === "verification" || raw === "verifying") return "verifying";
  if (raw === "reasoning" || raw === "thinking" || raw === "planning") return "thinking";
  if (raw === "summary" || raw === "summarizing") return "summarizing";
  if (raw === "response" || raw === "responding") return "responding";
  if (raw === "completed" || raw === "finished") return "completed";
  if (raw === "failed" || raw === "error") return "failed";
  if (raw === "cancelled" || raw === "canceled") return "cancelled";
  return raw;
}

function kindForPhase(phase: unknown): AgentActivityItem["kind"] {
  const key = activityKey(phase, "");
  if (key === "thinking" || key === "summarizing") return "reasoning";
  if (key === "editing" || key === "file_read" || key === "file_search" || key === "workspace_inspection") return "tool";
  return "status";
}

function toolKind(toolName: string): AgentActivityItem["kind"] {
  return toolName === "run_command" || toolName === "bash_run" || toolName === "bash_background"
    ? "command"
    : "tool";
}

function phaseForTool(toolName: string): string {
  if (toolName === "read_file" || toolName === "read_important_files") return "file_read";
  if (toolName === "search_files" || toolName === "grep" || toolName === "glob") return "file_search";
  if (toolName === "list_files" || toolName === "glob_files" || toolName === "list_directory" || toolName === "inspect_project") return "workspace_inspection";
  if (toolName === "apply_patch" || toolName === "write_file" || toolName === "propose_edit" || toolName === "edit" || toolName === "multi_edit") return "editing";
  if (toolName === "run_command" || toolName === "bash_run" || toolName === "bash_background" || toolName === "suggest_command") return `command:${toolName}`;
  return `tool:${toolName}`;
}

function labelForTool(toolName: string): string {
  if (toolName === "run_command" || toolName === "bash_run") return "Running command";
  if (toolName === "bash_background") return "Starting background command";
  if (toolName === "read_file") return "Reading files";
  if (toolName === "search_files" || toolName === "grep" || toolName === "glob") return "Searching files";
  if (toolName === "list_files" || toolName === "glob_files" || toolName === "list_directory") return "Inspecting workspace";
  if (toolName === "apply_patch" || toolName === "write_file" || toolName === "edit" || toolName === "multi_edit") return "Editing files";
  if (toolName === "read_url") return "Reading URL";
  return toolName.replace(/_/g, " ");
}

function labelForPhase(phase: string): string {
  if (phase === "thinking") return "Thinking";
  if (phase === "summarizing") return "Summarizing";
  if (phase === "responding") return "Responding";
  if (phase === "workspace_inspection") return "Inspecting workspace";
  if (phase === "file_search") return "Searching files";
  if (phase === "file_read") return "Reading files";
  if (phase === "editing") return "Editing files";
  if (phase === "verifying") return "Verifying";
  if (phase === "completed") return "Completed";
  if (phase === "failed") return "Run failed";
  if (phase === "cancelled") return "Cancelled";
  return phase.replace(/_/g, " ");
}

function plannedSummaryForTool(toolName: string, args?: Record<string, unknown>): string {
  const path = typeof args?.path === "string" ? args.path : undefined;
  if (toolName === "inspect_project" || toolName === "list_files") {
    return "Checking the workspace structure to identify framework, source folders, and project metadata.";
  }
  if (toolName === "search_files" || toolName === "grep" || toolName === "glob") {
    return "Looking for files that reveal dependencies, storage, UI architecture, and app purpose.";
  }
  if (toolName === "read_file" || toolName === "read_important_files") {
    return path ? `Reading ${path} before answering.` : "Reading the most relevant files before writing the response.";
  }
  if (toolName === "apply_patch" || toolName === "write_file" || toolName === "edit" || toolName === "multi_edit") {
    return path ? `Preparing a targeted file change for ${path}.` : "Preparing a targeted file change.";
  }
  if (toolName === "run_command" || toolName === "bash_run" || toolName === "bash_background") return "Preparing to run a workspace command.";
  return "Preparing a tool action for this request.";
}

function detailForTool(toolName: string, args?: Record<string, unknown>): string[] | undefined {
  const path = typeof args?.path === "string" ? args.path : undefined;
  const query = typeof args?.query === "string" ? args.query : undefined;
  if (path) return [`Target: ${path}`];
  if (query) return [`Search: ${query}`];
  if (toolName === "read_important_files") return ["Target: key project files"];
  return undefined;
}

function completeActivity(
  state: AgentMessageState,
  toolCallId: string,
  status: AgentActivityItem["status"],
) {
  const index = state.activities.findIndex((item) => item.toolCallId === toolCallId);
  if (index >= 0) {
    state.activities[index] = { ...state.activities[index], status };
  }
}

function completeEarlierRunningPhases(state: AgentMessageState, activePhase: string) {
  const activeOrder = PHASE_ORDER[activePhase] ?? 999;
  state.activities = state.activities.map((item) => {
    if (item.status !== "running") return item;
    const phase = item.toolCallId ?? "";
    if (phase === activePhase) return item;
    const phaseOrder = PHASE_ORDER[phase] ?? 999;
    return phaseOrder <= activeOrder ? { ...item, status: "complete" } : item;
  });
}

function completeAllRunning(state: AgentMessageState, status: AgentActivityItem["status"]) {
  state.activities = state.activities.map((item) =>
    item.status === "running" ? { ...item, status } : item,
  );
}

function normalizeActivityOrder(state: AgentMessageState) {
  state.activities.sort((a, b) => {
    const ao = PHASE_ORDER[a.toolCallId ?? ""] ?? 500;
    const bo = PHASE_ORDER[b.toolCallId ?? ""] ?? 500;
    if (ao !== bo) return ao - bo;
    return 0;
  });
}

function editedFileFromTool(call: AgentToolCall): AgentEditedFile | null {
  if (call.isError) return null;
  if (call.name === "apply_patch" || call.name === "edit") {
    const path = stringArg(call, "path");
    if (!path) return null;
    const oldText = stringArg(call, "expected_old_text") ?? stringArg(call, "old_string") ?? "";
    const newText = stringArg(call, "replacement_text") ?? stringArg(call, "new_string") ?? "";
    return {
      path,
      deletions: countLines(oldText),
      additions: countLines(newText),
    };
  }
  if (call.name === "multi_edit") {
    const path = stringArg(call, "path");
    const edits = call.arguments?.edits;
    if (!path || !Array.isArray(edits)) return null;
    return edits.reduce<AgentEditedFile>(
      (acc, edit) => {
        if (!edit || typeof edit !== "object") return acc;
        const oldText = "old_string" in edit && typeof edit.old_string === "string" ? edit.old_string : "";
        const newText = "new_string" in edit && typeof edit.new_string === "string" ? edit.new_string : "";
        acc.deletions += countLines(oldText);
        acc.additions += countLines(newText);
        return acc;
      },
      { path, additions: 0, deletions: 0 },
    );
  }
  if (call.name === "write_file") {
    const path = stringArg(call, "path");
    if (!path) return null;
    return {
      path,
      additions: countLines(stringArg(call, "content") ?? ""),
      deletions: 0,
    };
  }
  return null;
}

function stringArg(call: AgentToolCall, key: string): string | undefined {
  const value = call.arguments?.[key];
  return typeof value === "string" ? value : undefined;
}

function countLines(value: string): number {
  if (!value) return 0;
  return value.replace(/\n$/, "").split("\n").length;
}

function mergeEditedFile(state: AgentMessageState, edited: AgentEditedFile) {
  const existing = state.editedFiles.find((item) => item.path === edited.path);
  if (existing) {
    existing.additions += edited.additions;
    existing.deletions += edited.deletions;
    return;
  }
  state.editedFiles.push(edited);
}

function pushUnique(items: string[], value: string) {
  const index = items.indexOf(value);
  if (index >= 0) items.splice(index, 1);
  items.push(value);
}

function stripQuotes(value: unknown): string {
  return String(value ?? "").replace(/^"|"$/g, "");
}

function friendlyApprovalReason(reason: unknown): string | undefined {
  const value = stripQuotes(reason);
  if (!value || value === "preset-default") return "Default preset allowed this action.";
  if (value === "preset-auto-review") return "Auto-review preset allowed this action.";
  if (value === "preset-full-access") return "Full access preset allowed this action.";
  return value;
}

function friendlyReviewDecision(decision: unknown, reason: unknown): string | undefined {
  const decisionText = stripQuotes(decision);
  const reasonText = friendlyApprovalReason(reason);
  if (!decisionText && !reasonText) return undefined;
  if (!decisionText) return reasonText;
  if (!reasonText) return decisionText;
  return `${decisionText}. ${reasonText}`;
}

function reconcileText(streamedText: string, finalText: string): string {
  if (!finalText.trim()) return streamedText;
  if (!streamedText.trim()) return finalText;
  const streamed = streamedText.trim();
  const finalValue = finalText.trim();
  if (normaliseText(streamed) === normaliseText(finalValue)) return finalText;
  if (finalText.startsWith(streamedText)) return finalText;
  if (streamedText.startsWith(finalText)) return streamedText;
  if (finalText.includes(streamed)) return finalText;
  if (streamedText.includes(finalValue)) return streamedText;
  if (normaliseText(stripMarkdown(streamed)) === normaliseText(stripMarkdown(finalValue))) {
    return streamedText;
  }
  return finalText.length >= streamedText.length ? finalText : streamedText;
}

function stripMarkdown(value: string): string {
  return value.replace(/[*_`~#>\[\]()]/g, "").replace(/\s+/g, " ").trim();
}

function normaliseText(value: string): string {
  return stripMarkdown(value).toLowerCase().replace(/[.!?…]+$/g, "");
}
