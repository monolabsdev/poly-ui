// Pure accumulator — no React, no Tauri. Testable standalone.
// Batches content updates and flushes on rAF.

export type BatchUpdate = Record<string, string>;

export class StreamAccumulator {
  content: Record<string, string> = {};
  thinking: Record<string, string> = {};
  private pending: Record<string, string> = {};
  private hasScheduledFlush = false;
  private flushCallback: ((updates: BatchUpdate) => void) | null = null;

  onFlush(cb: (updates: BatchUpdate) => void) {
    this.flushCallback = cb;
  }

  queueTokenBatch(messageId: string, newContent: string) {
    this.pending[messageId] = newContent;
    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (this.hasScheduledFlush) return;
    this.hasScheduledFlush = true;
    if (typeof requestAnimationFrame !== "undefined") {
      requestAnimationFrame(() => this.flush());
    }
  }

  flush() {
    this.hasScheduledFlush = false;
    const batches = this.pending;
    if (Object.keys(batches).length === 0) return;
    this.pending = {};
    this.flushCallback?.(batches);
  }

  reset(requestIds?: string[]) {
    if (requestIds) {
      for (const rid of requestIds) {
        delete this.content[rid];
        delete this.thinking[rid];
      }
    } else {
      this.content = {};
      this.thinking = {};
    }
  }
}
