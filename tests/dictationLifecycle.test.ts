import { expect, test } from "bun:test";
import { markDictationMounted } from "../src/hooks/dictationLifecycle";

test("restores mounted state after a StrictMode effect cleanup and rerun", () => {
  const mountedRef = { current: false };

  const firstCleanup = markDictationMounted(mountedRef);
  expect(mountedRef.current).toBe(true);

  firstCleanup();
  expect(mountedRef.current).toBe(false);

  const secondCleanup = markDictationMounted(mountedRef);
  expect(mountedRef.current).toBe(true);

  secondCleanup();
  expect(mountedRef.current).toBe(false);
});
