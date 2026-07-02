import type { Message } from "@/types/chat";
import type { ChunkPayload, ThinkingPayload, WebSearchPayload } from "./stream-client";
import { StreamAccumulator, type BatchUpdate } from "./stream-accumulator";

export type StreamRequest = {
  requestId: string;
  messageId: string;
  conversationId: string;
};

export type CompletedChunk = {
  requestId: string;
  messageId: string;
  conversationId: string;
  content: string;
  thinking?: string;
  error?: string;
};

export type WebSearchPatch = {
  messageId: string;
  webSearch: Message["webSearch"];
};

export class StreamSession {
  private accumulator = new StreamAccumulator();
  private requestIdToMessageId: Record<string, string> = {};
  private requestIdToConversationId: Record<string, string> = {};
  private thinkingStartTime: Record<string, number> = {};
  private thinkingEndTime: Record<string, number> = {};
  private pendingStreams = 0;
  private cancelled = false;

  onFlush(cb: (updates: BatchUpdate) => void) {
    this.accumulator.onFlush(cb);
  }

  start(expectedStreams: number) {
    this.reset();
    this.pendingStreams = expectedStreams;
    this.cancelled = false;
  }

  register(request: StreamRequest) {
    this.requestIdToMessageId[request.requestId] = request.messageId;
    this.requestIdToConversationId[request.requestId] = request.conversationId;
  }

  applyChunk(payload: ChunkPayload): CompletedChunk | null {
    if (this.cancelled) return null;

    const messageId = this.requestIdToMessageId[payload.request_id];
    const conversationId = this.requestIdToConversationId[payload.request_id];
    if (!messageId || !conversationId) return null;

    const previous = this.accumulator.content[payload.request_id] ?? "";
    const content = previous + payload.content;
    this.accumulator.content[payload.request_id] = content;

    if (payload.thinking) {
      const prevThinking = this.accumulator.thinking[payload.request_id] ?? "";
      this.accumulator.thinking[payload.request_id] = prevThinking + payload.thinking;
    }

    if (!payload.done) {
      this.accumulator.queueTokenBatch(messageId, content);
      return null;
    }

    this.accumulator.flush();

    return {
      requestId: payload.request_id,
      messageId,
      conversationId,
      content,
      thinking: this.accumulator.thinking[payload.request_id],
      error: payload.error,
    };
  }

  applyThinking(payload: ThinkingPayload) {
    if (this.cancelled) return null;

    const messageId = this.requestIdToMessageId[payload.request_id];
    if (!messageId) return null;

    // Backend sends full accumulated thinking each event — replace, don't append
    this.accumulator.thinking[payload.request_id] = payload.thinking;
    if (payload.is_thinking && !this.thinkingStartTime[payload.request_id]) {
      this.thinkingStartTime[payload.request_id] = Date.now();
    }
    // Capture when thinking stops — duration must not include answer generation
    if (
      !payload.is_thinking &&
      this.thinkingStartTime[payload.request_id] &&
      !this.thinkingEndTime[payload.request_id]
    ) {
      this.thinkingEndTime[payload.request_id] = Date.now();
    }

    return {
      messageId,
      patch: {
        thinking: payload.thinking,
        isThinking: payload.is_thinking,
        status: "streaming" as const,
      },
    };
  }

  applyWebSearch(payload: WebSearchPayload, existing?: Message): WebSearchPatch | null {
    if (this.cancelled) return null;

    const messageId = this.requestIdToMessageId[payload.request_id];
    if (!messageId) return null;

    const previous = existing?.webSearch?.results ?? [];
    const merged = payload.results
      ? [
          ...previous,
          ...payload.results.filter((result) => !previous.some((item) => item.url === result.url)),
        ]
      : previous;

    return {
      messageId,
      webSearch: {
        request_id: payload.request_id,
        query: payload.query,
        status: payload.status,
        results: merged,
      },
    };
  }

  finish(requestId: string) {
    // Idempotent: error paths can settle the same request twice (done-chunk with
    // error + rejected invoke). A second finish must not decrement pendingStreams.
    if (!(requestId in this.requestIdToMessageId)) return this.pendingStreams;
    delete this.requestIdToMessageId[requestId];
    delete this.requestIdToConversationId[requestId];
    this.accumulator.reset([requestId]);
    this.pendingStreams = Math.max(0, this.pendingStreams - 1);
    return this.pendingStreams;
  }

  cancel() {
    this.cancelled = true;
  }

  dispose() {
    this.accumulator.dispose();
    this.requestIdToMessageId = {};
    this.requestIdToConversationId = {};
    this.thinkingStartTime = {};
    this.thinkingEndTime = {};
    this.pendingStreams = 0;
    this.cancelled = true;
  }

  reset() {
    this.accumulator.reset();
    this.requestIdToMessageId = {};
    this.requestIdToConversationId = {};
    this.thinkingStartTime = {};
    this.thinkingEndTime = {};
    this.pendingStreams = 0;
    this.cancelled = false;
  }

  isComplete() {
    return this.pendingStreams === 0;
  }

  allMessageIds() {
    return Object.values(this.requestIdToMessageId);
  }

  requestIdForMessage(messageId: string) {
    return Object.entries(this.requestIdToMessageId).find(([, mid]) => mid === messageId)?.[0];
  }

  messageIdForRequest(requestId: string) {
    return this.requestIdToMessageId[requestId];
  }

  thinkingDuration(requestId?: string) {
    if (!requestId) return undefined;
    const startedAt = this.thinkingStartTime[requestId];
    if (!startedAt) return undefined;
    return ((this.thinkingEndTime[requestId] ?? Date.now()) - startedAt) / 1000;
  }
}
