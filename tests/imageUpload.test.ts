import { expect, test } from "bun:test";
import { validateImageFiles } from "../src/lib/image-upload/validation";
import { ObjectUrlRegistry } from "../src/lib/image-upload/object-url";
import { UploadQueue } from "../src/lib/image-upload/upload-queue";

const image = (name: string, size = 4, type = "image/png") =>
  new File([new Uint8Array(size)], name, { type });

test("rejects unsupported image types and oversized files", () => {
  const result = validateImageFiles([
    image("bad.svg", 4, "image/svg+xml"),
    image("huge.png", 20, "image/png"),
  ], { maxFileSize: 10 });
  expect(result.accepted).toHaveLength(0);
  expect(result.errors.map((error) => error.code)).toEqual(["unsupported-type", "file-too-large"]);
});

test("rejects files beyond configured batch limit", () => {
  const result = validateImageFiles([image("one.png"), image("two.png")], { maxFiles: 1 });
  expect(result.accepted).toHaveLength(1);
  expect(result.errors[0]?.code).toBe("too-many-files");
});

test("revokes object URLs on release and clear", () => {
  const revoked: string[] = [];
  let next = 0;
  const registry = new ObjectUrlRegistry(
    () => `blob:${++next}`,
    (url) => revoked.push(url),
  );
  const first = registry.create(image("one.png"));
  registry.create(image("two.png"));
  registry.release(first);
  registry.clear();
  expect(revoked).toEqual(["blob:1", "blob:2"]);
});

test("upload queue limits concurrency and retries failed items", async () => {
  let active = 0;
  let peak = 0;
  const attempts = new Map<string, number>();
  const queue = new UploadQueue<string, string>(async (value) => {
    active++;
    peak = Math.max(peak, active);
    attempts.set(value, (attempts.get(value) ?? 0) + 1);
    await Bun.sleep(5);
    active--;
    if (value === "retry" && attempts.get(value) === 1) throw new Error("fail");
    return value;
  }, { concurrency: 2 });
  const results = await Promise.all([
    queue.add("one"),
    queue.add("two"),
    queue.add("retry").catch(() => queue.retry("retry")),
  ]);
  expect(results).toEqual(["one", "two", "retry"]);
  expect(peak).toBe(2);
});

test("upload queue cancels pending item", async () => {
  const queue = new UploadQueue<string, string>(async (value) => {
    await Bun.sleep(10);
    return value;
  }, { concurrency: 1 });
  const first = queue.add("one");
  const second = queue.add("two");
  const cancelled = second.then(() => "resolved", (error: Error) => error.message);
  queue.cancel("two");
  await expect(first).resolves.toBe("one");
  expect(await cancelled).toBe("cancelled");
});
