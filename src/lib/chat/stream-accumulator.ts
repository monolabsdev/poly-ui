// Pure accumulator — no React, no Tauri. Testable standalone.
// Batches content updates and flushes on a short debounce.

export type BatchUpdate = Record<string, string>;

export class StreamAccumulator {
  content: Record<string, string> = {};
  thinking: Record<string, string> = {};
  private pending: Record<string, string> = {};
  private hasScheduledFlush = false;
  private flushCallback: ((updates: BatchUpdate) => void) | null = null;
  private flushRaf: number | null = null;
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
    this.flushRaf = requestAnimationFrame(() => {
      this.flushRaf = null;
      this.flush();
    });
  }

  flush() {
    this.hasScheduledFlush = false;
    if (this.flushRaf !== null) {
      cancelAnimationFrame(this.flushRaf);
      this.flushRaf = null;
    }
    if (this.disposed) return;
    const batches = this.pending;
    if (Object.keys(batches).length === 0) return;
    this.pending = {};
    this.flushCallback?.(batches);
  }

  dispose() {
    this.disposed = true;
    if (this.flushRaf !== null) cancelAnimationFrame(this.flushRaf);
    this.flushRaf = null;
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
    if (this.flushRaf !== null) cancelAnimationFrame(this.flushRaf);
    this.flushRaf = null;
    this.hasScheduledFlush = false;
    this.pending = {};
  }
}
