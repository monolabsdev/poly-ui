import { getLastSeenVersion, setLastSeenVersion } from "../src/features/release-notes/releaseNotesStorage";
import {
  fetchReleases,
  selectUnseenReleases,
  simplifyCommits,
  fillEmptyBodies,
  clearReleaseNotesCache,
  type Release,
} from "../src/features/release-notes/releaseNotesApi";
import { normalizeAppVersion, compareAppVersions } from "../src/lib/utils/appVersion";

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

function release(version: string, body = `notes for ${version}`): Release {
  return { version, tag: `v${version}`, body, htmlUrl: "", publishedAt: null };
}

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

  it("handles localStorage unavailability gracefully", () => {
    const setItem = globalThis.localStorage.setItem;
    globalThis.localStorage.setItem = () => { throw new Error("quota exceeded"); };
    expect(() => setLastSeenVersion("0.13.0")).not.toThrow();
    globalThis.localStorage.setItem = setItem;
  });
});

describe("compareAppVersions", () => {
  it("compares numerically, not lexically", () => {
    expect(compareAppVersions("0.17.10", "0.17.9")).toBe(1);
    expect(compareAppVersions("0.17.9", "0.17.10")).toBe(-1);
    expect(compareAppVersions("1.0.0", "0.99.99")).toBe(1);
  });

  it("treats equal and v-prefixed versions as equal", () => {
    expect(compareAppVersions("0.17.0", "v0.17.0")).toBe(0);
    expect(compareAppVersions("1.0", "1.0.0")).toBe(0);
  });
});

describe("selectUnseenReleases", () => {
  const all = [release("0.17.10"), release("0.17.9"), release("0.17.0"), release("0.16.1")];

  it("returns every release newer than lastSeen up to installed", () => {
    const unseen = selectUnseenReleases(all, "0.17.10", "0.16.1");
    expect(unseen.map((r) => r.version)).toEqual(["0.17.10", "0.17.9", "0.17.0"]);
  });

  it("shows only the patch when earlier releases were acknowledged", () => {
    const unseen = selectUnseenReleases(all, "0.17.9", "0.17.0");
    expect(unseen.map((r) => r.version)).toEqual(["0.17.9"]);
  });

  it("excludes releases newer than the installed version", () => {
    const unseen = selectUnseenReleases(all, "0.17.0", "0.16.1");
    expect(unseen.map((r) => r.version)).toEqual(["0.17.0"]);
  });

  it("shows only the installed release on fresh install", () => {
    const unseen = selectUnseenReleases(all, "0.17.9", null);
    expect(unseen.map((r) => r.version)).toEqual(["0.17.9"]);
  });
});

describe("simplifyCommits", () => {
  it("keeps feat/fix/perf/refactor and drops noise", () => {
    const raw = [
      "* feat(ui): improve viewport drawer (71271bd)",
      "* fix: respect isStreaming flag (aadbf42)",
      "* perf: batch token updates (1234567)",
      "* refactor: simplify styling (eb1b5cd)",
      "* chore(version): bump to v0.17.0 (4a95266)",
      "* Merge pull request #92 from monolabsdev/dev (e8bd7c2)",
      "* docs: update README (abc1234)",
      "* test: update regression guard (8b25e4c)",
      "* ci: fix workflow (def5678)",
    ].join("\n");

    expect(simplifyCommits(raw)).toBe(
      [
        "- Improve viewport drawer",
        "- Respect isStreaming flag",
        "- Batch token updates",
        "- Simplify styling",
      ].join("\n"),
    );
  });

  it("returns null when nothing user-facing remains", () => {
    expect(simplifyCommits("* chore: bump\n* Merge pull request #1")).toBeNull();
    expect(simplifyCommits("")).toBeNull();
  });
});

describe("fetchReleases", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("returns published releases sorted newest first", async () => {
    globalThis.fetch = async () =>
      new Response(
        JSON.stringify([
          { tag_name: "v0.17.9", body: "old", html_url: "u9", draft: false, prerelease: false },
          { tag_name: "v0.17.10", body: "new", html_url: "u10", draft: false, prerelease: false },
          { tag_name: "v0.18.0", body: "draft", html_url: "ud", draft: true, prerelease: false },
          { tag_name: "v0.18.0-beta", body: "pre", html_url: "up", draft: false, prerelease: true },
        ]),
        { status: 200 },
      );

    const releases = await fetchReleases();
    expect(releases?.map((r) => r.version)).toEqual(["0.17.10", "0.17.9"]);
    expect(releases?.[0].htmlUrl).toBe("u10");
  });

  it("returns null on network error and does not cache the failure", async () => {
    globalThis.fetch = async () => { throw new Error("offline"); };
    expect(await fetchReleases()).toBeNull();

    globalThis.fetch = async () =>
      new Response(JSON.stringify([{ tag_name: "v1.0.0", body: "b", html_url: "u" }]), { status: 200 });
    expect((await fetchReleases())?.length).toBe(1);
  });

  it("returns null on error status", async () => {
    globalThis.fetch = async () => new Response(null, { status: 403 });
    expect(await fetchReleases()).toBeNull();
  });

  it("caches successful results", async () => {
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      return new Response(JSON.stringify([{ tag_name: "v1.0.0", body: "b", html_url: "u" }]), { status: 200 });
    };

    await fetchReleases();
    await fetchReleases();
    expect(callCount).toBe(1);
  });
});

describe("fillEmptyBodies", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it("fills an empty body from the commit range since the previous release", async () => {
    globalThis.fetch = async (url: RequestInfo) => {
      expect(String(url)).toContain("/compare/v0.17.0...v0.17.1");
      return new Response(
        JSON.stringify({
          commits: [
            { commit: { message: "fix: crash on startup\n\ndetails" } },
            { commit: { message: "chore: bump version" } },
          ],
        }),
        { status: 200 },
      );
    };

    const all = [release("0.17.1", ""), release("0.17.0")];
    const filled = await fillEmptyBodies([all[0]], all);
    expect(filled[0].body).toBe("- Crash on startup");
  });

  it("leaves non-empty bodies untouched without fetching", async () => {
    globalThis.fetch = async () => { throw new Error("should not fetch"); };
    const all = [release("0.17.1")];
    const filled = await fillEmptyBodies(all, all);
    expect(filled[0].body).toBe("notes for 0.17.1");
  });
});
