import { getLastSeenVersion, setLastSeenVersion } from "../src/features/release-notes/releaseNotesStorage";
import { fetchReleaseNotes, clearReleaseNotesCache } from "../src/features/release-notes/releaseNotesApi";
import { normalizeAppVersion } from "../src/lib/utils/appVersion";

const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => store.set(k, v),
    clear: () => store.clear(),
    removeItem: (k: string) => store.delete(k),
    get length() { return store.size; },
    key: (i: number) => [...store.keys()][i] ?? null,
  },
  writable: true,
  configurable: true,
});

beforeEach(() => {
  store.clear();
  clearReleaseNotesCache();
});

describe("releaseNotesStorage", () => {
  it("normalizes v-prefixed versions", () => {
    expect(normalizeAppVersion("v0.13.0")).toBe("0.13.0");
    setLastSeenVersion("v0.13.0");
    expect(getLastSeenVersion()).toBe("0.13.0");
  });

  it("returns null when nothing stored", () => {
    expect(getLastSeenVersion()).toBeNull();
  });

  it("stores and retrieves version", () => {
    setLastSeenVersion("0.13.0");
    expect(getLastSeenVersion()).toBe("0.13.0");
  });

  it("overwrites previous version", () => {
    setLastSeenVersion("0.12.0");
    setLastSeenVersion("0.13.0");
    expect(getLastSeenVersion()).toBe("0.13.0");
  });

  it("handles localStorage unavailability gracefully", () => {
    const setItem = globalThis.localStorage.setItem;
    globalThis.localStorage.setItem = () => { throw new Error("quota exceeded"); };
    expect(() => setLastSeenVersion("0.13.0")).not.toThrow();
    globalThis.localStorage.setItem = setItem;
  });
});

describe("releaseNotesApi", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("tries v-prefixed tag first, then bare tag", async () => {
    const calls: string[] = [];
    globalThis.fetch = async (url: RequestInfo) => {
      calls.push(String(url));
      if (String(url).includes("v0.13.0")) {
        return new Response(JSON.stringify({ body: "# Notes", html_url: "https://github.com/releases/v0.13.0" }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    };

    const result = await fetchReleaseNotes("0.13.0");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body).toBe("# Notes");
    }
    expect(calls[0]).toContain("v0.13.0");
  });

  it("falls back to bare tag when v-prefixed 404s", async () => {
    const calls: string[] = [];
    globalThis.fetch = async (url: RequestInfo) => {
      calls.push(String(url));
      if (String(url).includes("0.13.0") && !String(url).includes("v0.13.0")) {
        return new Response(JSON.stringify({ body: "# Notes", html_url: "https://github.com/releases/0.13.0" }), { status: 200 });
      }
      return new Response(null, { status: 404 });
    };

    const result = await fetchReleaseNotes("0.13.0");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body).toBe("# Notes");
    }
    expect(calls[0]).toContain("v0.13.0");
    expect(calls[1]).toContain("0.13.0");
  });

  it("returns ok:false on network error", async () => {
    globalThis.fetch = async () => { throw new Error("network failure"); };
    const result = await fetchReleaseNotes("0.13.0");
    expect(result.ok).toBe(false);
  });

  it("returns ok:false on non-404 error status", async () => {
    globalThis.fetch = async () => new Response(null, { status: 403 });
    const result = await fetchReleaseNotes("0.13.0");
    expect(result.ok).toBe(false);
  });

  it("caches results per version", async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return new Response(JSON.stringify({ body: "# Notes", html_url: "" }), { status: 200 });
    };

    const a = await fetchReleaseNotes("0.13.0");
    const b = await fetchReleaseNotes("0.13.0");
    expect(callCount).toBe(1);
    expect(a.ok).toBe(b.ok);
  });
});
