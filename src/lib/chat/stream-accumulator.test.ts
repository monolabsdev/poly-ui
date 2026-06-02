import { expect, test } from "bun:test";
import { StreamAccumulator } from "./stream-accumulator";

test("coalesces token batches and flushes latest content after debounce", async () => {
  const accumulator = new StreamAccumulator();
  const flushes: Record<string, string>[] = [];
  accumulator.onFlush((updates) => flushes.push(updates));

  accumulator.queueTokenBatch("message", "a");
  accumulator.queueTokenBatch("message", "ab");
  await Bun.sleep(100);
  expect(flushes).toEqual([]);

  accumulator.queueTokenBatch("message", "abc");
  await Bun.sleep(100);
  expect(flushes).toEqual([{ message: "abc" }]);
});
