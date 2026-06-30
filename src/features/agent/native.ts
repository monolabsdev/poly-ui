import { invoke } from "@tauri-apps/api/core";

export type AgentDirEntry = { name: string; kind: "file" | "dir" };
export type AgentGrepHit = { path: string; line: number; text: string };
export type AgentCommandOutput = {
  stdout: string;
  stderr: string;
  status: number;
  timedOut: boolean;
};

export function prepareChatSandbox(chatId: string): Promise<string> {
  return invoke<string>("agent_prepare_chat_sandbox", { chatId });
}

export function readTextFile(workspacePath: string, path: string): Promise<string> {
  return invoke<string>("agent_read_text_file", { workspacePath, path });
}

export function writeTextFile(workspacePath: string, path: string, content: string): Promise<void> {
  return invoke("agent_write_text_file", { workspacePath, path, content });
}

export function listDirectory(workspacePath: string, path: string): Promise<AgentDirEntry[]> {
  return invoke<AgentDirEntry[]>("agent_list_directory", { workspacePath, path });
}

export function grep(workspacePath: string, pattern: string, maxResults = 50): Promise<AgentGrepHit[]> {
  return invoke<AgentGrepHit[]>("agent_grep", { workspacePath, pattern, maxResults });
}

export function runCommand(
  workspacePath: string,
  command: string,
  timeoutSecs = 60,
): Promise<AgentCommandOutput> {
  return invoke<AgentCommandOutput>("agent_run_command", {
    request: { workspacePath, command, timeoutSecs },
  });
}
