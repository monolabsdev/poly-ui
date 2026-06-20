import type { StepStatus } from "@/components/ui/agent-trace";
import type { AgentApproval, AgentEditedFile, AgentMessageState, AgentToolCall } from "../types";
import { compactActivities } from "./compactActivities";
import { editedFileLabel, uniqueDisplayDetails } from "./summaries";

export type StepDef = {
  id: string;
  status: StepStatus;
  label: string;
  type: "default" | "editing" | "approval" | "error" | "command";
  summary?: string;
  details?: string[];
  defaultExpanded: boolean;
  files?: AgentEditedFile[];
  approval?: AgentApproval;
  errorDetail?: string;
  command?: AgentToolCall;
};

const STEP_STATUS_MAP: Record<string, StepStatus> = {
  running: "running",
  complete: "complete",
  error: "error",
  waiting: "waiting",
};

export function buildSteps(agent: AgentMessageState): StepDef[] {
  const toolCalls = Object.values(agent.toolCalls);
  const activities = compactActivities(agent.activities);

  /* Always show at least thinking/responding steps while running.
     Simple chat shows only Thinking/Responding, not full tool trace. */
  const hasToolWork = toolCalls.some((t) => t.status !== "requested")
    || agent.editedFiles.length > 0
    || agent.approvals.length > 0;
  const isRunningOrRecent = agent.status === "running" || agent.status === "waiting_for_approval" || agent.status === "cancelling";
  const hasReasoningSteps = activities.some((a) => a.kind === "reasoning");
  const shouldShowSimpleChatTrace = !hasToolWork && (isRunningOrRecent || hasReasoningSteps);

  /* For simple chat with no tool work, only show reasoning steps */
  if (!hasToolWork && !shouldShowSimpleChatTrace) return [];

  const steps: StepDef[] = [];
  let lastLabel: string | undefined;

  for (let i = 0; i < activities.length; i++) {
    const act = activities[i];

    /* Skip empty or consecutive duplicate labels */
    if (!act.label || act.label === lastLabel) continue;
    lastLabel = act.label;

    /* Skip "Starting" — header status badge already shows it */
    if (act.label === "Starting") continue;
    if (act.label === "Completed") continue;

    const s = STEP_STATUS_MAP[act.status ?? ""] ?? "pending";
    const summary = stepSummary(act, agent);
    const step: StepDef = {
      id: act.id,
      status: s,
      label: act.label,
      type: "default",
      summary,
      details: uniqueDisplayDetails(act.details, summary),
      defaultExpanded: s === "error" || s === "waiting",
    };

    if (act.kind === "error") {
      step.type = "error";
      step.errorDetail = act.detail;
    }

    if (act.kind === "approval") {
      step.type = "approval";
      step.label = "Permission checked";
      if (
        agent.permissionPreset === "full-access" ||
        agent.permissionPreset === "auto-review"
      ) {
        step.status = "complete";
      }
    }

    if (act.kind === "command") {
      step.type = "command";
      const call = act.toolCallId
        ? toolCalls.find((t) => t.id === act.toolCallId)
        : undefined;
      step.command = call;
    }

    if (
      act.toolCallId &&
      (act.status === "complete" || act.status === "error" || act.label === "Editing file" || act.label === "Editing files")
    ) {
      const call = toolCalls.find((t) => t.id === act.toolCallId)
        ?? toolCalls.find((t) => t.name === "apply_patch" || t.name === "write_file");
      if (
        call &&
        (call.name === "apply_patch" || call.name === "write_file")
      ) {
        step.type = "editing";
        step.defaultExpanded = true;
        step.label = editedFileLabel(agent.editedFiles, call);
      }
    }

    steps.push(step);
  }

  /* Attach file data to the last editing step */
  if (agent.editedFiles.length > 0) {
    const editSteps = steps.filter((s) => s.type === "editing");
    if (editSteps.length > 0) {
      editSteps[editSteps.length - 1].files = agent.editedFiles;
    }
  }

  /* Attach approval data */
  if (agent.approvals.length > 0) {
    const approvalSteps = steps.filter((s) => s.type === "approval");
    if (approvalSteps.length > 0) {
      approvalSteps[approvalSteps.length - 1].approval = agent.approvals[0];
    }
  }

  /* Attach error detail */
  if (agent.error) {
    const errorSteps = steps.filter((s) => s.type === "error");
    if (errorSteps.length > 0) {
      errorSteps[errorSteps.length - 1].errorDetail = agent.error;
    }
  }

  /* Limit running trace to avoid excessive updates.
     Completed traces keep full history - do NOT pop steps. */
  const hasRunning = steps.some((s) => s.status === "running");
  if (hasRunning && steps.length > 12) return steps.slice(-12);

  return steps;
}

function stepSummary(
  act: { label: string; kind?: string; detail?: string; status?: string },
  agent: AgentMessageState,
): string | undefined {
  const label = act.label?.toLowerCase() ?? "";
  if (label === "completed") return undefined;

  /* Completed phases: prefer original detail, fall back to deterministic summary */
  if (act.status === "complete" || act.status === "error") {
    if (act.detail && act.detail.length > 0 && act.detail.length < 150) {
      return act.detail;
    }
    return deterministicCompletedSummary(label);
  }

  /* Running phases with detail: use it */
  if (act.status === "running" && act.detail) {
    return act.detail;
  }

  /* Running phases without detail */
  if (act.status === "running" && !act.detail) {
    if (label.includes("think")) return "Understanding the request and preparing the next action.";
    if (label.includes("respond")) return "Receiving the model response.";
    if (label.includes("summar")) return "Preparing the final response.";
    return "Waiting for the model response...";
  }

  /* Approval */
  if (act.kind === "approval") {
    if (
      agent.permissionPreset === "full-access" ||
      agent.permissionPreset === "auto-review"
    ) {
      return "Approved automatically by the current access mode.";
    }
    return act.detail || "Waiting for permission before continuing.";
  }

  /* Label-based summaries for tools */
  if (label.includes("read") && label.includes("file"))
    return "Checking available files in the current workspace.";
  if (label.includes("read") && label.includes("context"))
    return "Loading the current file state before making changes.";
  if (label.includes("resolv"))
    return "Resolved the target file for this task.";
  if (label.includes("edit") || label.includes("patch"))
    return "Applying a targeted edit to the file.";
  if (label.includes("file") && (label.includes("creat") || label.includes("write")))
    return "Creating the requested file in the workspace.";
  if (label.includes("tool") || label.includes("call"))
    return "Running a tool to process the request.";

  /* Fall through to deterministic */
  if (act.detail && act.detail.length > 0 && act.detail.length < 150)
    return act.detail;

  return fallbackSummary(label);
}

function deterministicCompletedSummary(label: string): string {
  if (label.includes("think")) return "Understood the request and prepared the next action.";
  if (label.includes("respond")) return "Received the model response.";
  if (label.includes("summar")) return "Prepared the final response.";
  if (label.includes("inspect") || label.includes("workspace")) return "Inspected the selected workspace.";
  if (label.includes("search")) return "Searched relevant project files.";
  if (label.includes("read")) return "Read relevant file contents.";
  if (label.includes("edit") || label.includes("patch") || label.includes("file")) return "Applied the requested file changes.";
  if (label.includes("verify")) return "Verified the changes.";
  if (label.includes("complete")) return "Finished.";
  if (label.includes("cancel")) return "Stopped the agent run.";
  return "Completed the task.";
}

export function hasDisclosureContent(
  step: Pick<StepDef, "summary" | "details" | "type" | "files" | "approval" | "errorDetail" | "command">,
): boolean {
  return Boolean(
    step.summary?.trim()
      || step.details?.some((detail) => detail.trim())
      || step.files?.length
      || step.approval
      || step.errorDetail?.trim()
      || step.command,
  );
}

function fallbackSummary(label: string): string {
  if (label.includes("think")) return "Preparing the next action.";
  if (label.includes("respond")) return "Waiting for the model response.";
  if (label.includes("inspect") || label.includes("workspace"))
    return "Checking the selected workspace.";
  if (label.includes("search")) return "Looking for relevant project files.";
  if (label.includes("read")) return "Loading relevant file contents.";
  if (label.includes("summar")) return "Preparing the final answer.";
  if (label.includes("complete")) return "Finished.";
  if (label.includes("cancel")) return "Stopped the agent run.";
  return "Working on the request.";
}

/* ─── Content sub-components ─── */
