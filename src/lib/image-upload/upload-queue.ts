type QueueOptions = { concurrency?: number };
type Entry<I, O> = { input: I; resolve: (value: O) => void; reject: (error: Error) => void };

export class UploadQueue<I, O> {
  private readonly pending: Entry<I, O>[] = [];
  private readonly failed = new Map<I, Entry<I, O>>();
  private active = 0;
  private readonly concurrency: number;

  constructor(private readonly upload: (input: I) => Promise<O>, options: QueueOptions = {}) {
    this.concurrency = Math.max(1, options.concurrency ?? 2);
  }

  add(input: I) {
    return new Promise<O>((resolve, reject) => {
      this.pending.push({ input, resolve, reject });
      this.pump();
    });
  }

  cancel(input: I) {
    const index = this.pending.findIndex((entry) => entry.input === input);
    if (index < 0) return;
    this.pending.splice(index, 1)[0].reject(new Error("cancelled"));
  }

  retry(input: I) {
    const failed = this.failed.get(input);
    if (!failed) return Promise.reject(new Error("nothing to retry"));
    this.failed.delete(input);
    return this.add(input);
  }

  private pump() {
    while (this.active < this.concurrency && this.pending.length) {
      const entry = this.pending.shift()!;
      this.active++;
      this.upload(entry.input)
        .then(entry.resolve)
        .catch((error: Error) => {
          this.failed.set(entry.input, entry);
          entry.reject(error);
        })
        .finally(() => {
          this.active--;
          this.pump();
        });
    }
  }
}

