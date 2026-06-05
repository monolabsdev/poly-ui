import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type ChunkPayload = {
  request_id: string;
  content: string;
  done: boolean;
  thinking?: string;
  metadata?: {
    prompt_eval_count?: number;
    eval_count?: number;
    total_duration?: number;
    load_duration?: number;
    prompt_eval_duration?: number;
    eval_duration?: number;
  };
  error?: string;
};

export type ThinkingPayload = {
  request_id: string;
  thinking: string;
  is_thinking: boolean;
};

export type WebSearchPayload = {
  request_id: string;
  query: string;
  status: "searching" | "complete" | "error";
  results?: { title: string; url: string; highlights: string[] }[];
};

export type StreamHandlers = {
  onChunk: (payload: ChunkPayload) => void;
  onThinking: (payload: ThinkingPayload) => void;
  onWebSearch: (payload: WebSearchPayload) => void;
};

// Typed wrapper around Tauri event bus. Replaces the singleton StreamEventBus
// with an injectable seam — tests can pass a mock EventBus instead.
export interface EventBus {
  subscribe(handlers: StreamHandlers): Promise<void>;
  unsubscribe(): Promise<void>;
}

export class TauriEventBus implements EventBus {
  private unlisteners: (UnlistenFn | Promise<UnlistenFn>)[] = [];
  private handlers: StreamHandlers | null = null;

  async subscribe(handlers: StreamHandlers) {
    this.handlers = handlers;
    if (this.unlisteners.length > 0) return;
    this.unlisteners = [
      listen<ChunkPayload>("chat-chunk", (e) => this.handlers?.onChunk(e.payload)),
      listen<ThinkingPayload>("chat-thinking", (e) => this.handlers?.onThinking(e.payload)),
      listen<WebSearchPayload>("web-search-event", (e) => this.handlers?.onWebSearch(e.payload)),
    ];
  }

  async unsubscribe() {
    const toUnsubscribe = [...this.unlisteners];
    this.unlisteners = [];
    this.handlers = null;
    for (const u of toUnsubscribe) {
      const fn = await u;
      fn();
    }
  }
}
