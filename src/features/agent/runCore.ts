// Pure, testable run-lifecycle logic for the SDK agent runtime.

export type SdkRunStatus =
  | "running"
  | "waiting_for_approval"
  | "finished"
  | "failed"
  | "cancelled";

const TRANSITIONS: Record<SdkRunStatus, SdkRunStatus[]> = {
  running: ["waiting_for_approval", "finished", "failed", "cancelled"],
  waiting_for_approval: ["running", "failed", "cancelled"],
  finished: [],
  failed: [],
  cancelled: [],
};

export function isTerminalStatus(status: SdkRunStatus): boolean {
  return TRANSITIONS[status].length === 0;
}

export function canTransition(from: SdkRunStatus, to: SdkRunStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export type ToolResult =
  | { ok: true; data: unknown; summary: string; durationMs: number }
  | {
      ok: false;
      error: { code: string; message: string; recoverable: boolean };
      durationMs: number;
    };

export function toolOk(data: unknown, summary: string, durationMs: number): ToolResult {
  return { ok: true, data, summary, durationMs };
}

export function toolErr(
  code: string,
  message: string,
  recoverable: boolean,
  durationMs: number,
): ToolResult {
  return { ok: false, error: { code, message, recoverable }, durationMs };
}

const MUTATING_TOOLS = new Set(["write_file", "edit", "multi_edit", "run_command"]);

export function isMutatingTool(toolName: string): boolean {
  return MUTATING_TOOLS.has(toolName);
}

// Providers sometimes retransmit the exact tool call they just made. Key the
// immediately previous mutation so an identical repeat returns the cached
// result instead of executing twice.
export function mutationKey(toolName: string, args: unknown): string {
  return `${toolName}:${JSON.stringify(args)}`;
}

export const EVENT_OUTPUT_LIMIT = 4000;

export function truncateForEvent(text: string, limit = EVENT_OUTPUT_LIMIT): string {
  if (text.length <= limit) return text;
  return `${text.slice(0, limit)}\n… [truncated ${text.length - limit} of ${text.length} chars]`;
}

export type ExecutedTool = { name: string; ok: boolean; path?: string; command?: string };

// The model sometimes stops after successful tool work without emitting final
// text. Synthesize an accurate summary instead of failing the run.
export function synthesizeCompletionSummary(tools: ExecutedTool[]): string {
  const succeeded = tools.filter((tool) => tool.ok);
  if (succeeded.length === 0) return "";
  const editedPaths = [
    ...new Set(
      succeeded
        .filter((tool) => tool.name === "write_file" || tool.name === "edit" || tool.name === "multi_edit")
        .map((tool) => tool.path)
        .filter((path): path is string => Boolean(path)),
    ),
  ];
  const commands = succeeded.filter((tool) => tool.name === "run_command").length;
  const parts: string[] = [];
  if (editedPaths.length === 1) parts.push(`Edited \`${editedPaths[0]}\`.`);
  else if (editedPaths.length > 1) {
    parts.push(`Edited ${editedPaths.length} files:\n${editedPaths.map((path) => `- \`${path}\``).join("\n")}`);
  }
  if (commands > 0) parts.push(`Ran ${commands} command${commands === 1 ? "" : "s"}.`);
  if (parts.length === 0) {
    parts.push(`Completed ${succeeded.length} tool action${succeeded.length === 1 ? "" : "s"} without file changes.`);
  }
  return parts.join("\n\n");
}

export function replaceExact(
  content: string,
  oldString: string,
  newString: string,
  replaceAll: boolean,
): string {
  if (!oldString) throw new Error("old_string cannot be empty.");
  if (oldString === newString) throw new Error("old_string and new_string are identical.");
  if (replaceAll) {
    if (!content.includes(oldString)) throw new Error("old_string not found.");
    return content.split(oldString).join(newString);
  }
  const first = content.indexOf(oldString);
  if (first === -1) throw new Error("old_string not found.");
  if (content.indexOf(oldString, first + oldString.length) !== -1) {
    throw new Error("old_string is not unique.");
  }
  return content.slice(0, first) + newString + content.slice(first + oldString.length);
}

export type ApprovalDecision =
  | { mode: "auto_approve"; reason: string }
  | { mode: "ask" };

// Exact preset behavior — no ambiguous fallthrough:
//   sandbox      -> everything auto-approved (isolated temp dir)
//   full-access  -> everything auto-approved
//   auto-review  -> workspace file edits auto-approved (path-checked,
//                   revertible via git); shell commands still ask
//   default      -> every mutating tool asks
export function decideApproval(
  preset: "default" | "auto-review" | "full-access",
  sandbox: boolean,
  toolName: string,
): ApprovalDecision {
  if (sandbox) return { mode: "auto_approve", reason: "Sandbox workspace." };
  if (preset === "full-access") return { mode: "auto_approve", reason: "Full access enabled." };
  if (preset === "auto-review" && toolName !== "run_command") {
    return { mode: "auto_approve", reason: "Auto preset: workspace file edit." };
  }
  return { mode: "ask" };
}
