import type { Message } from "@/types/chat";
import type { AgentResolvedContext, AgentToolCall } from "./types";

const FILE_PATTERN = /(?:^|\s|["'`(])((?:[\w.-]+[\\/])*[\w.-]+\.[A-Za-z0-9]{1,12})(?=$|\s|["'`),.!?:;])/g;
const MAX_RECENT_FILES = 8;

export function buildAgentResolvedContext(args: {
  messages: Message[];
  prompt: string;
  workspacePath?: string;
  selectedFile?: string;
}): AgentResolvedContext {
  const recentlyViewedFiles: string[] = [];
  const recentlyEditedFiles: string[] = [];
  const recentConstraints: string[] = [];
  let previousActiveFile: string | undefined;
  let lastToolCall: AgentResolvedContext["lastToolCall"];

  for (const message of args.messages) {
    if (message.role === "user") {
      for (const file of extractFileMentions(message.content)) {
        previousActiveFile = file;
        pushUnique(recentlyViewedFiles, file);
      }
      for (const constraint of extractConstraints(message.content)) {
        pushUnique(recentConstraints, constraint);
      }
    }

    const agent = message.agent;
    if (!agent) continue;
    if (agent.context?.activeFile) previousActiveFile = agent.context.activeFile;
    for (const file of agent.context?.recentlyViewedFiles ?? []) pushUnique(recentlyViewedFiles, file);
    for (const file of agent.context?.recentlyEditedFiles ?? []) pushUnique(recentlyEditedFiles, file);
    for (const constraint of agent.context?.recentConstraints ?? []) pushUnique(recentConstraints, constraint);

    for (const call of Object.values(agent.toolCalls)) {
      const targetPath = targetPathForTool(call);
      if (!targetPath) continue;
      lastToolCall = { toolName: call.name, targetPath };
      previousActiveFile = targetPath;
      if (call.name === "read_file") pushUnique(recentlyViewedFiles, targetPath);
      if (isEditTool(call.name) && call.status === "completed" && !call.isError) {
        pushUnique(recentlyEditedFiles, targetPath);
      }
    }

    for (const file of agent.editedFiles) {
      previousActiveFile = file.path;
      pushUnique(recentlyEditedFiles, file.path);
    }
  }

  const explicit = extractFileMentions(args.prompt)[0];
  const activeFile =
    explicit ??
    args.selectedFile ??
    previousActiveFile;

  if (explicit) pushUnique(recentlyViewedFiles, explicit);

  return {
    activeWorkspace: args.workspacePath,
    activeFile,
    recentlyViewedFiles: trimRecent(recentlyViewedFiles),
    recentlyEditedFiles: trimRecent(recentlyEditedFiles),
    recentConstraints: trimRecent(recentConstraints, 5),
    lastToolCall,
  };
}

export function extractFileMentions(text: string): string[] {
  const files: string[] = [];
  for (const match of text.matchAll(FILE_PATTERN)) {
    pushUnique(files, match[1].replace(/\\/g, "/"));
  }
  return files;
}

export function extractConstraints(text: string): string[] {
  const lower = text.toLowerCase();
  const constraints: string[] = [];
  if (/(do not|don't)\s+remove|do not remove any|preserve existing|keep existing/.test(lower)) {
    constraints.push("Preserve existing content; do not remove anything.");
  }
  if (/append only|only append|add to (?:the )?end/.test(lower)) {
    constraints.push("Append only.");
  }
  if (/(do not|don't)\s+change formatting|keep formatting/.test(lower)) {
    constraints.push("Do not change formatting.");
  }
  if (/only edit (?:this|that|the same)?\s*file/.test(lower)) {
    constraints.push("Only edit the active file.");
  }
  if (/(do not|don't)\s+run commands/.test(lower)) {
    constraints.push("Do not run commands.");
  }
  return constraints;
}

export function isFollowUpInstruction(prompt: string): boolean {
  const lower = prompt.toLowerCase().trim();
  return /\b(it|that file|this file|same file|that|again|another|one more)\b/.test(lower)
    || /^(add|append|make|change|remove|undo|show|open|review|edit)\b/.test(lower);
}

export function detectFileEditIntent(prompt: string): boolean {
  const lower = prompt.toLowerCase();
  return /\b(create|add|make|write)\s+(?:a\s+|an\s+)?(?:new\s+)?file\b/.test(lower)
    || /\b(call|name)\s+it\s+[\w.-]+\.[a-z0-9]{1,12}\b/i.test(prompt)
    || /\b(edit|delete|rename|append|modify|update|replace|patch)\b/.test(lower) && extractFileMentions(prompt).length > 0
    || /\b(add|append|insert)\s+(?:more\s+)?(?:sentences?|text|content)\s+to\s+/.test(lower);
}

function targetPathForTool(call: AgentToolCall): string | undefined {
  const path = call.arguments?.path;
  return typeof path === "string" ? path.replace(/\\/g, "/") : undefined;
}

function isEditTool(toolName: string): boolean {
  return toolName === "apply_patch" || toolName === "write_file";
}

function pushUnique(items: string[], value: string) {
  const trimmed = value.trim();
  if (!trimmed) return;
  const index = items.indexOf(trimmed);
  if (index >= 0) items.splice(index, 1);
  items.push(trimmed);
}

function trimRecent(items: string[], max = MAX_RECENT_FILES): string[] {
  return items.slice(-max);
}
