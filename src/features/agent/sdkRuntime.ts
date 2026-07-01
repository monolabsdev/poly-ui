import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { isStepCount, streamText, tool, type LanguageModel } from "ai";
import { z } from "zod";
import type { AgentRawEvent } from "./agentClient";
import type { AgentRunStartOptions } from "./types";
import { checkReadable, checkShellCommand, checkWritable } from "./security";
import * as native from "./native";
import { getWebSearchConfig } from "@/features/web-search/useWebSearchConfig";
import { isFeatureAIActive } from "@/lib/featureRegistry";

type RunStatus = "running" | "waiting_for_approval" | "finished" | "failed" | "cancelled";
type ApprovalWaiter = { resolve: (approved: boolean) => void; payload: PendingApproval };
type PendingApproval = {
  approval_id: string;
  tool_name: string;
  risk: "RequiresApproval";
  reason: string | null;
  path: string | null;
  command_preview: string | null;
  diff_preview: string | null;
  raw_arguments: unknown;
};

type RunState = {
  runId: string;
  status: RunStatus;
  abort: AbortController;
  workspacePath: string;
  sandbox: boolean;
  permissionPreset: AgentRunStartOptions["permissionPreset"];
  pending?: ApprovalWaiter;
  finalOutput: string;
  reasoningOutput: string;
  lastError?: string;
};

const runs = new Map<string, RunState>();
const listeners = new Set<(event: AgentRawEvent) => void>();

export function listenLocalAgentEvents(callback: (event: AgentRawEvent) => void): () => void {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

export async function startSdkAgent(options: AgentRunStartOptions): Promise<string> {
  const workspacePath = await resolveWorkspacePath(options);
  const runId = crypto.randomUUID();
  const abort = new AbortController();
  const state: RunState = {
    runId,
    status: "running",
    abort,
    workspacePath,
    sandbox: options.workspaceSelection.type === "sandbox",
    permissionPreset: options.permissionPreset,
    finalOutput: "",
    reasoningOutput: "",
  };
  runs.set(runId, state);
  emit(runId, { kind: "started" });
  emit(runId, {
    kind: "activity",
    value: {
      phase: "thinking",
      title: "Starting",
      summary: "Preparing SDK agent run.",
      details: [],
      status: "running",
    },
  });
  void runSdkAgent(state, options);
  return runId;
}

export function cancelSdkAgent(runId: string): Promise<void> {
  const state = runs.get(runId);
  if (!state) return Promise.resolve();
  state.status = "cancelled";
  state.abort.abort();
  emit(runId, { kind: "cancelled" });
  return Promise.resolve();
}

export function approveSdkToolCall(runId: string, approvalId: string): Promise<void> {
  const state = runs.get(runId);
  if (!state?.pending || state.pending.payload.approval_id !== approvalId) {
    return Promise.reject(new Error("No pending approval."));
  }
  state.pending.resolve(true);
  state.pending = undefined;
  state.status = "running";
  return Promise.resolve();
}

export function rejectSdkToolCall(runId: string, approvalId: string): Promise<void> {
  const state = runs.get(runId);
  if (!state?.pending || state.pending.payload.approval_id !== approvalId) {
    return Promise.reject(new Error("No pending approval."));
  }
  state.pending.resolve(false);
  state.pending = undefined;
  state.status = "running";
  return Promise.resolve();
}

export function getSdkRunState(runId: string) {
  const state = runs.get(runId);
  if (!state) return Promise.reject(new Error("Run not found."));
  return Promise.resolve({
    status: state.status,
    pending_approval: state.pending
      ? { approval_id: state.pending.payload.approval_id }
      : null,
  });
}

async function resolveWorkspacePath(options: AgentRunStartOptions): Promise<string> {
  if (options.workspacePath) return options.workspacePath;
  if (options.workspaceSelection.type === "project") return options.workspaceSelection.path;
  return native.prepareChatSandbox(options.workspaceSelection.chatId);
}

async function runSdkAgent(state: RunState, options: AgentRunStartOptions) {
  try {
    const model = buildModel(options);
    emit(state.runId, { kind: "model_call_started", value: { step: 1 } });
    const result = streamText({
      model,
      system: SYSTEM_PROMPT,
      prompt: options.prompt,
      tools: buildTools(state),
      stopWhen: isStepCount(8),
      reasoning: "medium",
      abortSignal: state.abort.signal,
      onStepFinish: ({ stepNumber }) => {
        emit(state.runId, { kind: "model_call_finished", value: { step: stepNumber } });
      },
    });

    for await (const part of result.fullStream) {
      if (part.type === "text-delta") {
        state.finalOutput += part.text;
        emit(state.runId, { kind: "text_delta", value: { text: part.text } });
      } else if (part.type === "reasoning-delta") {
        state.reasoningOutput += part.text;
        emit(state.runId, {
          kind: "activity",
          value: {
            phase: "thinking",
            title: "Thinking",
            summary: state.reasoningOutput,
            details: [],
            status: "running",
          },
        });
      } else if (part.type === "error") {
        throw part.error instanceof Error ? part.error : new Error(String(part.error));
      }
    }

    if (!state.finalOutput.trim()) {
      throw new Error("The provider returned an empty response.");
    }
    state.status = "finished";
    emit(state.runId, { kind: "finished", value: { text: state.finalOutput } });
  } catch (error) {
    if (state.abort.signal.aborted || state.status === "cancelled") return;
    const message = formatRunError(error, options);
    state.status = "failed";
    state.lastError = message;
    emit(state.runId, { kind: "failed", value: { error: message } });
  }
}

function buildModel(options: AgentRunStartOptions): LanguageModel {
  const headers = parseHeaders(options.headers);
  if (options.provider === "OpenAICompatible") {
    if (!options.baseUrl) throw new Error("OpenAI-compatible provider has no base URL.");
    if (!options.apiKey && !isLocalBaseUrl(options.baseUrl)) {
      throw new Error(`API key missing for OpenAI-compatible connection: ${options.baseUrl}.`);
    }
    return createOpenAICompatible({
      name: "poly-openai-compatible",
      baseURL: options.baseUrl,
      apiKey: options.apiKey || undefined,
      headers,
    })(options.model);
  }

  const base = (options.baseUrl || "http://localhost:11434").replace(/\/$/, "");
  return createOpenAICompatible({
    name: "poly-ollama",
    baseURL: `${base}/v1`,
    apiKey: options.apiKey || "ollama",
    headers,
  })(options.model);
}

function parseHeaders(raw: string | null | undefined): Record<string, string> | undefined {
  if (!raw?.trim()) return undefined;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return undefined;
    return Object.fromEntries(
      Object.entries(parsed).filter((entry): entry is [string, string] =>
        typeof entry[0] === "string" && typeof entry[1] === "string" && entry[1].trim().length > 0
      ),
    );
  } catch {
    return undefined;
  }
}

function isLocalBaseUrl(baseUrl: string) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(?::|\/|$)/i.test(baseUrl);
}

function formatRunError(error: unknown, options: AgentRunStartOptions) {
  const message = error instanceof Error ? error.message : String(error);
  const context = options.provider === "OpenAICompatible"
    ? `${options.model} via ${options.baseUrl || "missing base URL"}`
    : `${options.model} via Ollama`;
  if (/No output generated/i.test(message)) {
    return `Provider returned no stream output for ${context}. Check model id and provider connection.`;
  }
  return `${message} (${context})`;
}

function buildTools(state: RunState) {
  const workspace = state.workspacePath;
  const webSearchConfig = isFeatureAIActive("web_search") ? getWebSearchConfig() : undefined;

  return {
    read_file: tool({
      description: "Read a UTF-8 text file inside the selected workspace. Refuses secret paths.",
      inputSchema: z.object({
        path: z.string(),
      }),
      execute: ({ path }, ctx) => executeTool(state, ctx.toolCallId, "read_file", { path }, async () => {
        const safety = checkReadable(path);
        if (!safety.ok) return { error: safety.reason, path };
        const content = await native.readTextFile(workspace, path);
        return { path, content: content.slice(0, 256 * 1024) };
      }),
    }),
    list_directory: tool({
      description: "List immediate non-hidden entries in a workspace directory.",
      inputSchema: z.object({ path: z.string().default(".") }),
      execute: ({ path }, ctx) => executeTool(state, ctx.toolCallId, "list_directory", { path }, async () => ({
        path,
        entries: await native.listDirectory(workspace, path),
      })),
    }),
    grep: tool({
      description: "Search text in workspace files. Use before broad file reads.",
      inputSchema: z.object({ pattern: z.string(), max_results: z.number().int().min(1).max(200).optional() }),
      execute: ({ pattern, max_results }, ctx) => executeTool(state, ctx.toolCallId, "grep", { pattern, max_results }, async () => ({
        pattern,
        hits: await native.grep(workspace, pattern, max_results ?? 50),
      })),
    }),
    write_file: tool({
      description: "Create or overwrite a file. Requires user approval.",
      inputSchema: z.object({ path: z.string(), content: z.string() }),
      execute: ({ path, content }, ctx) => executeTool(state, ctx.toolCallId, "write_file", { path, content }, async () => {
        const safety = checkWritable(path);
        if (!safety.ok) return { error: safety.reason, path };
        await requireApproval(state, ctx.toolCallId, "write_file", { path, content }, { path, diff: content.slice(0, 4000) });
        await native.writeTextFile(workspace, path, content);
        return { ok: true, path, bytesWritten: content.length };
      }),
    }),
    edit: tool({
      description: "Replace an exact string in a file. Requires user approval.",
      inputSchema: z.object({ path: z.string(), old_string: z.string(), new_string: z.string(), replace_all: z.boolean().optional() }),
      execute: ({ path, old_string, new_string, replace_all }, ctx) => executeTool(
        state,
        ctx.toolCallId,
        "edit",
        { path, old_string, new_string, replace_all },
        async () => {
          const safety = checkWritable(path);
          if (!safety.ok) return { error: safety.reason, path };
          await requireApproval(state, ctx.toolCallId, "edit", { path, old_string, new_string, replace_all }, { path, diff: new_string.slice(0, 4000) });
          const current = await native.readTextFile(workspace, path);
          const next = replaceExact(current, old_string, new_string, Boolean(replace_all));
          await native.writeTextFile(workspace, path, next);
          return { ok: true, path, replacements: replace_all ? "all" : 1 };
        },
      ),
    }),
    multi_edit: tool({
      description: "Apply several exact-string replacements to one file. Requires user approval.",
      inputSchema: z.object({
        path: z.string(),
        edits: z.array(z.object({ old_string: z.string(), new_string: z.string(), replace_all: z.boolean().optional() })).min(1),
      }),
      execute: ({ path, edits }, ctx) => executeTool(state, ctx.toolCallId, "multi_edit", { path, edits }, async () => {
        const safety = checkWritable(path);
        if (!safety.ok) return { error: safety.reason, path };
        await requireApproval(state, ctx.toolCallId, "multi_edit", { path, edits }, { path, diff: `${edits.length} edits` });
        let content = await native.readTextFile(workspace, path);
        for (const edit of edits) {
          content = replaceExact(content, edit.old_string, edit.new_string, Boolean(edit.replace_all));
        }
        await native.writeTextFile(workspace, path, content);
        return { ok: true, path, replacements: edits.length };
      }),
    }),
    run_command: tool({
      description: "Run one short shell command in the selected workspace. Requires user approval.",
      inputSchema: z.object({ command: z.string(), timeout_secs: z.number().int().min(1).max(300).optional() }),
      execute: ({ command, timeout_secs }, ctx) => executeTool(state, ctx.toolCallId, "run_command", { command, timeout_secs }, async () => {
        const safety = checkShellCommand(command);
        if (!safety.ok) return { error: safety.reason, command };
        await requireApproval(state, ctx.toolCallId, "run_command", { command, timeout_secs }, { command });
        return native.runCommand(workspace, command, timeout_secs ?? 60);
      }),
    }),
    ...(webSearchConfig
      ? {
          web_search: tool({
            description: "Search the web for current or external information.",
            inputSchema: z.object({ query: z.string().min(1) }),
            execute: ({ query }, ctx) => executeTool(state, ctx.toolCallId, "web_search", { query }, async () => ({
              query,
              results: await native.webSearch(query, webSearchConfig),
            })),
          }),
        }
      : {}),
  };
}

async function executeTool<T>(
  state: RunState,
  toolCallId: string,
  toolName: string,
  args: Record<string, unknown>,
  fn: () => Promise<T>,
): Promise<T> {
  emit(state.runId, {
    kind: "tool_call_requested",
    value: { tool_call_id: toolCallId, tool_name: toolName, arguments: args as never },
  });
  emit(state.runId, {
    kind: "tool_call_started",
    value: { tool_call_id: toolCallId, tool_name: toolName },
  });
  try {
    const output = await fn();
    emit(state.runId, {
      kind: "tool_call_finished",
      value: {
        tool_call_id: toolCallId,
        output: JSON.stringify(output, null, 2),
        is_error: Boolean(output && typeof output === "object" && "error" in output),
        cached: false,
      },
    });
    return output;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    emit(state.runId, {
      kind: "tool_call_finished",
      value: { tool_call_id: toolCallId, output: message, is_error: true, cached: false },
    });
    throw error;
  }
}

function requireApproval(
  state: RunState,
  approvalId: string,
  toolName: string,
  rawArguments: unknown,
  preview: { path?: string; command?: string; diff?: string },
): Promise<void> {
  if (state.status === "cancelled") return Promise.reject(new Error("Run cancelled."));
  if (state.sandbox) {
    emit(state.runId, {
      kind: "tool_auto_approved",
      value: { tool_call_id: approvalId, tool_name: toolName, reason: "Sandbox workspace." },
    });
    return Promise.resolve();
  }
  if (state.permissionPreset === "full-access") {
    emit(state.runId, {
      kind: "tool_auto_approved",
      value: { tool_call_id: approvalId, tool_name: toolName, reason: "Full access enabled." },
    });
    return Promise.resolve();
  }
  const payload: PendingApproval = {
    approval_id: approvalId,
    tool_name: toolName,
    risk: "RequiresApproval",
    reason: `${toolName} requires approval.`,
    path: preview.path ?? null,
    command_preview: preview.command ?? null,
    diff_preview: preview.diff ?? null,
    raw_arguments: rawArguments,
  };
  state.status = "waiting_for_approval";
  emit(state.runId, { kind: "approval_required", value: payload as never });
  return new Promise((resolve, reject) => {
    state.pending = {
      payload,
      resolve: (approved) => {
        if (!approved) reject(new Error(`${toolName} rejected by user.`));
        else resolve();
      },
    };
  });
}

function replaceExact(content: string, oldString: string, newString: string, replaceAll: boolean) {
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

function emit(runId: string, data: AgentRawEvent["data"]) {
  const event: AgentRawEvent = {
    run_id: runId,
    event_type: "agent",
    timestamp: new Date().toISOString(),
    data,
  };
  for (const listener of listeners) listener(event);
}

const SYSTEM_PROMPT = `You are Poly Agent, an AI coding agent inside Poly UI.

Core rules:
- Execute, don't echo. When asked to create/fix/edit, use tools.
- Chain actions until done: inspect -> edit -> verify.
- Ask only when ambiguity is costly.
- Read before editing. Keep changes scoped.
- Mutating tools require user approval; do not claim completion until tool succeeds.
- Keep final response concise.`;
