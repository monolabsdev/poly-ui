import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { SearchResultItem } from "@/types/chat";

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
  results?: SearchResultItem[];
};

type Handlers = {
  onChunk: (payload: ChunkPayload) => void;
  onThinking: (payload: ThinkingPayload) => void;
  onWebSearch: (payload: WebSearchPayload) => void;
};

export class StreamEventBus {
  private static instance: StreamEventBus;
  private unlisteners: (UnlistenFn | Promise<UnlistenFn>)[] = [];
  private handlers: Handlers | null = null;

  static getInstance() {
    if (!this.instance) this.instance = new StreamEventBus();
    return this.instance;
  }

  async subscribe(handlers: Handlers) {
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

export const streamEventBus = StreamEventBus.getInstance();

