// Backward-compat re-export. New code should import from ./stream-client directly.
export {
  TauriEventBus,
  type ChunkPayload,
  type ThinkingPayload,
  type WebSearchPayload,
  type StreamHandlers,
  type EventBus,
} from "./stream-client";

import { TauriEventBus, type StreamHandlers } from "./stream-client";

export class StreamEventBus {
  private static instance: StreamEventBus;
  private bus = new TauriEventBus();

  static getInstance() {
    if (!this.instance) this.instance = new StreamEventBus();
    return this.instance;
  }

  async subscribe(handlers: StreamHandlers) {
    await this.bus.subscribe(handlers);
  }

  async unsubscribe() {
    await this.bus.unsubscribe();
  }
}

export const streamEventBus = StreamEventBus.getInstance();
