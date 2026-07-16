import { invoke } from "@tauri-apps/api/core";
import type { WebSearchConfig } from "@/features/web-search/types";

export type AgentDirEntry = { name: string; kind: "file" | "dir" };
export type AgentGrepHit = { path: string; line: number; text: string };
export type AgentCommandOutput = {
  stdout: string;
  stderr: string;
  status: number;
  timedOut: boolean;
};
export type AgentSearchResult = {
  title: string;
  url: string;
  highlights: string[];
};
export type WebSearchResult = {
  id: string;
  title: string;
  url: string;
  display_url: string;
  snippet: string;
  published_at: string | null;
  providers: string[];
  score: number;
};
export type SearchWebResponse = {
  query: string;
  results: WebSearchResult[];
  providers_used: string[];
  providers_failed: { provider: string; error: string }[];
  cached: boolean;
};
export type ReadWebResultsResponse = {
  sources: {
    source_id: string;
    result_id: string;
    title: string;
    url: string;
    canonical_url: string;
    domain: string;
    published_at: string | null;
    retrieved_at: string;
    passages: { text: string; score: number; section: string | null }[];
    trust: "untrusted_web_content";
  }[];
  failed_results: { result_id: string; error: string }[];
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

/** Resolve a workspace file to a loopback URL for the browser webview. */
export function agentViewportServeFile(workspacePath: string, path: string): Promise<string> {
  return invoke<string>("agent_viewport_serve_file", { workspacePath, path });
}

export function agentViewportStopServing(): Promise<void> {
  return invoke("agent_viewport_stop_serving");
}

export function webSearch(query: string, config: WebSearchConfig): Promise<AgentSearchResult[]> {
  return invoke<AgentSearchResult[]>("agent_web_search", { query, config });
}

export function searchWeb(request: {
  query: string;
  max_results?: number;
  freshness?: "day" | "week" | "month" | "year" | "any";
  include_domains?: string[];
  exclude_domains?: string[];
}): Promise<SearchWebResponse> {
  return invoke<SearchWebResponse>("agent_search_web", { request });
}

export function readWebResults(request: {
  result_ids: string[];
  max_passages_per_result?: number;
}): Promise<ReadWebResultsResponse> {
  return invoke<ReadWebResultsResponse>("agent_read_web_results", { request });
}
