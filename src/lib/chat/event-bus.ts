import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type ChunkPayload = {
  request_id: string;
  content: string;
  done: boolean;
  metadata?: {
    prompt_eval_count?: number;
    eval_count?: number;
    total_duration?: number;
    load_duration?: number;
    prompt_eval_duration?: number;
    eval_duration?: number;
  };
};

export type ThinkingPayload = {
  request_id: string;
  thinking: string;
  is_thinking: boolean;
};

export type ToolInvocationPayload = {
  invocation_id: string;
  request_id: string;
  tool_name: string;
  tool_args: Record<string, unknown>;
  requires_approval: boolean;
};

export class StreamEventBus {
  private unlisteners: UnlistenFn[] = [];

  async subscribe(handlers: {
    onChunk: (payload: ChunkPayload) => void;
    onThinking: (payload: ThinkingPayload) => void;
    onTool: (payload: ToolInvocationPayload) => void;
  }) {
    this.unlisteners = await Promise.all([
      listen<ChunkPayload>("chat-chunk", (e) => handlers.onChunk(e.payload)),
      listen<ThinkingPayload>("chat-thinking", (e) => handlers.onThinking(e.payload)),
      listen<ToolInvocationPayload>("tool-invocation", (e) => handlers.onTool(e.payload)),
    ]);
  }

  unsubscribe() {
    this.unlisteners.forEach((u) => u());
    this.unlisteners = [];
  }
}
