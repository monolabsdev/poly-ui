import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(() => Promise.resolve(null)),
}));

import { createSafeJsonStorage } from "../src/store/persistStorage";

const store = new Map<string, string>();

Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => store.set(key, value),
    clear: () => store.clear(),
    removeItem: (key: string) => store.delete(key),
    get length() {
      return store.size;
    },
    key: (index: number) => [...store.keys()][index] ?? null,
  },
  writable: true,
  configurable: true,
});

describe("createSafeJsonStorage", () => {
  beforeEach(() => {
    store.clear();
  });

  it("returns null for missing persisted files", () => {
    const storage = createSafeJsonStorage<{ enabled: boolean }>();

    expect(storage.getItem("polyui:settings")).toBeNull();
  });

  it("recovers malformed persisted JSON by backing up only that key", () => {
    const storage = createSafeJsonStorage<{ enabled: boolean }>();
    store.set("polyui:settings", '{"state":');
    store.set("session_token", "secret-token");

    expect(storage.getItem("polyui:settings")).toBeNull();
    expect(store.has("polyui:settings")).toBe(false);
    expect(store.get("session_token")).toBe("secret-token");
    expect([...store.keys()].some((key) => key.startsWith("polyui:settings.corrupt-"))).toBe(true);
  });

  it("recovers invalid persisted envelopes", () => {
    const storage = createSafeJsonStorage<{ enabled: boolean }>();
    store.set("polyui:settings", JSON.stringify({ enabled: true }));

    expect(storage.getItem("polyui:settings")).toBeNull();
    expect([...store.keys()].some((key) => key.startsWith("polyui:settings.corrupt-"))).toBe(true);
  });

  it("loads valid persisted state", () => {
    const storage = createSafeJsonStorage<{ enabled: boolean }>();
    store.set("polyui:settings", JSON.stringify({ state: { enabled: true }, version: 1 }));

    expect(storage.getItem("polyui:settings")).toEqual({
      state: { enabled: true },
      version: 1,
    });
  });
});
