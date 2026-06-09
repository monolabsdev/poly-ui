// Pure accumulator — no React, no Tauri. Testable standalone.
// Batches content updates and flushes on a short debounce.

export type BatchUpdate = Record<string, string>;

export class StreamAccumulator {
  content: Record<string, string> = {};
  thinking: Record<string, string> = {};
  private pending: Record<string, string> = {};
  private hasScheduledFlush = false;
  private flushCallback: ((updates: BatchUpdate) => void) | null = null;
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private disposed = false;

  onFlush(cb: (updates: BatchUpdate) => void) {
    this.flushCallback = cb;
  }

  queueTokenBatch(messageId: string, newContent: string) {
    if (this.disposed) return;
    this.pending[messageId] = newContent;
    this.scheduleFlush();
  }

  private scheduleFlush() {
    if (this.hasScheduledFlush || this.disposed) return;
    this.hasScheduledFlush = true;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flush();
    }, 175);
  }

  flush() {
    this.hasScheduledFlush = false;
    if (this.flushTimer) {
      clearTimeout(this.flushTimer);
      this.flushTimer = null;
    }
    if (this.disposed) return;
    const batches = this.pending;
    if (Object.keys(batches).length === 0) return;
    this.pending = {};
    this.flushCallback?.(batches);
  }

  dispose() {
    this.disposed = true;
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    this.flushCallback = null;
    this.hasScheduledFlush = false;
    this.pending = {};
    this.content = {};
    this.thinking = {};
  }

  reset(requestIds?: string[]) {
    this.disposed = false;
    if (requestIds) {
      for (const rid of requestIds) {
        delete this.content[rid];
        delete this.thinking[rid];
      }
    } else {
      this.content = {};
      this.thinking = {};
    }
    if (this.flushTimer) clearTimeout(this.flushTimer);
    this.flushTimer = null;
    this.hasScheduledFlush = false;
    this.pending = {};
  }
}
