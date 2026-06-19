import type { AgentEditedFile, AgentMessageState, AgentToolCall } from "../types";

export function editedFileLabel(
  files: AgentEditedFile[],
  call: AgentToolCall,
): string {
  if (files.length > 0) {
    if (files.length === 1) {
      const f = files[0];
      if (f.additions > 0 && f.deletions === 0)
        return `Updated ${fileName(f.path)}`;
      return `Edited ${fileName(f.path)}`;
    }
    return `Edited ${files.length} files`;
  }
  const path =
    typeof call.arguments?.path === "string" ? call.arguments.path : "";
  return path ? `Edited ${fileName(path)}` : "Editing files";
}

export function fileName(path: string) {
  return path.split(/[\\/]/).pop() || path;
}

export type AgentResult = {
  kind:
    | "files"
    | "command"
    | "noop"
    | "clarification"
    | "error"
    | "approval"
    | "progress";
  tone: "normal" | "warning" | "error";
  title: string;
  detail: string;
};

export function agentResult(
  agent: AgentMessageState,
  resultText?: string,
): AgentResult {
  if (agent.status === "failed")
    return {
      kind: "error",
      tone: "error",
      title: "Run failed",
      detail:
        agent.error || "The agent stopped before completing.",
    };
  if (agent.status === "waiting_for_approval" && agent.approvals[0]) {
    const a = agent.approvals[0];
    return {
      kind: "approval",
      tone: "warning",
      title: "Waiting for approval",
      detail: a.path
        ? `${a.toolName} needs approval for ${fileName(a.path)}.`
        : a.commandPreview
          ? `${a.toolName} needs approval.`
          : "Approval needed.",
    };
  }
  if (agent.editedFiles.length > 0) {
    return {
      kind: "files",
      tone: "normal",
      title: fileChangeTitle(agent.editedFiles),
      detail:
        agent.editedFiles.length === 1
          ? `${operationSummary(agent.editedFiles[0])} in ${agent.editedFiles[0].path}.`
          : `${agent.editedFiles.length} files changed`,
    };
  }
  const cmd = lastCommand(agent);
  if (cmd)
    return {
      kind: "command",
      tone: cmd.isError || cmd.status === "failed" ? "warning" : "normal",
      title: "Ran command",
      detail: commandSummary(cmd),
    };
  const text = cleanResultText(resultText);
  if (text && looksLikeClarification(text))
    return {
      kind: "clarification",
      tone: "warning",
      title: "Needs clarification",
      detail: text,
    };
  if (text) {
    if (agent.request?.fileEditRequested && !agent.editedFiles.length)
      return {
        kind: "noop",
        tone: "warning",
        title: "No file changes",
        detail: text,
      };
    return { kind: "noop", tone: "normal", title: "Completed", detail: text };
  }
  if (agent.status === "completed") {
    const target = currentRunTargetPath(agent);
    return {
      kind: "noop",
      tone: agent.request?.fileEditRequested ? "warning" : "normal",
      title: target ? "No file changes" : "No changes",
      detail: target
        ? `Request completed, no edits for ${fileName(target)}.`
        : agent.request?.fileEditRequested
          ? "No changes produced."
          : "No changes reported.",
    };
  }
  return {
    kind: "progress",
    tone: "normal",
    title: "Working",
    detail: "Processing request.",
  };
}

function fileChangeTitle(files: AgentMessageState["editedFiles"]) {
  if (files.length !== 1) return `Edited ${files.length} files`;
  const f = files[0];
  if (f.additions > 0 && f.deletions === 0)
    return `Updated ${fileName(f.path)}`;
  return `Edited ${fileName(f.path)}`;
}

function operationSummary(file: {
  additions: number;
  deletions: number;
}) {
  if (file.additions > 0 && file.deletions === 0) return "Updated";
  if (file.deletions > 0 && file.additions === 0) return "Removed content";
  return "Modified";
}

function lastCommand(agent: AgentMessageState) {
  const cmds = Object.values(agent.toolCalls).filter(
    (c) => c.name === "run_command",
  );
  return cmds[cmds.length - 1];
}

export function commandSummary(call: AgentToolCall) {
  const cmd =
    typeof call.arguments?.command === "string"
      ? call.arguments.command
      : "Command";
  const output = call.output || call.outputDelta || "";
  const exitCode = /Exit code:\s*([^\n]+)/i.exec(output)?.[1]?.trim();
  if (exitCode) return `${cmd} → exit ${exitCode}.`;
  if (call.status === "running") return `${cmd} running.`;
  if (call.status === "failed" || call.isError) return `${cmd} failed.`;
  return `${cmd} completed.`;
}

function cleanResultText(text?: string) {
  return text?.replace(/\s+/g, " ").trim();
}

function looksLikeClarification(text: string) {
  return /\b(clarif|ambiguous|need (more|additional|details|information)|please specify|which file)\b/i.test(
    text,
  );
}

function currentRunTargetPath(agent: AgentMessageState) {
  if (agent.request?.targetFile) return agent.request.targetFile;
  const mc = Object.values(agent.toolCalls).find(
    (c) =>
      ["apply_patch", "write_file"].includes(c.name) &&
      typeof c.arguments?.path === "string",
  );
  return typeof mc?.arguments?.path === "string"
    ? mc.arguments.path
    : undefined;
}
export function uniqueDisplayDetails(details: string[] | undefined, summary: string | undefined) {
  if (!details?.length) return undefined;
  const seen = new Set<string>();
  const summaryKey = summary ? detailKey(summary) : "";
  const out: string[] = [];
  for (const detail of details) {
    const key = detailKey(detail);
    if (!key || key === summaryKey || seen.has(key)) continue;
    seen.add(key);
    out.push(detail);
  }
  return out.length ? out : undefined;
}

export function detailKey(value: string) {
  return value.trim().toLowerCase().replace(/[.!?…]+$/g, "").replace(/\s+/g, " ");
}
