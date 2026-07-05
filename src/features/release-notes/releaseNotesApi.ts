import bundledReleaseNotes from "@/generated/releaseNotes.json";
import { compareAppVersions, normalizeAppVersion } from "@/lib/utils/appVersion";

const REPO = "monolabsdev/poly-ui";
const GH_API = "https://api.github.com";
const TIMEOUT_MS = 8_000;

export const RELEASES_URL = `https://github.com/${REPO}/releases`;

export interface Release {
  version: string; // normalized, no "v" prefix
  tag: string;
  body: string; // markdown
  htmlUrl: string;
  publishedAt: string | null;
}

let releasesCache: Release[] | null = null;

export function clearReleaseNotesCache(): void {
  releasesCache = null;
}

async function ghFetch(path: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(`${GH_API}/repos/${REPO}${path}`, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function releaseUrl(version: string): string {
  return `${RELEASES_URL}/tag/v${normalizeAppVersion(version) ?? version}`;
}

/** All published (non-draft, non-prerelease) releases, newest first. Null on network/API failure. */
export async function fetchReleases(): Promise<Release[] | null> {
  if (releasesCache) return releasesCache;

  const data = await ghFetch("/releases?per_page=30");
  if (!Array.isArray(data)) return null;

  const releases: Release[] = [];
  for (const item of data as Array<Record<string, unknown>>) {
    if (!item || item.draft === true || item.prerelease === true) continue;
    const version = normalizeAppVersion(item.tag_name);
    if (!version) continue;
    releases.push({
      version,
      tag: String(item.tag_name),
      body: typeof item.body === "string" ? item.body.trim() : "",
      htmlUrl: typeof item.html_url === "string" ? item.html_url : releaseUrl(version),
      publishedAt: typeof item.published_at === "string" ? item.published_at : null,
    });
  }

  releases.sort((a, b) => compareAppVersions(b.version, a.version));
  releasesCache = releases;
  return releases;
}

/**
 * Releases the user hasn't acknowledged yet: newer than lastSeen, no newer than
 * the installed version. With no lastSeen (fresh install), only the installed release.
 */
export function selectUnseenReleases(
  releases: Release[],
  installedVersion: string,
  lastSeen: string | null,
): Release[] {
  return releases.filter((r) => {
    if (compareAppVersions(r.version, installedVersion) > 0) return false;
    if (lastSeen === null) return compareAppVersions(r.version, installedVersion) === 0;
    return compareAppVersions(r.version, lastSeen) > 0;
  });
}

const USER_FACING_COMMIT = /^(feat|fix|perf|refactor)(\([^)]*\))?!?:\s*/i;

/** Reduce raw commit subjects (one per line, optional "* " / "(hash)" noise) to user-facing bullets. */
export function simplifyCommits(raw: string): string | null {
  const bullets = raw
    .split("\n")
    .map((line) =>
      line
        .replace(/^\*\s*/, "")
        .replace(/\s*\([0-9a-f]{7,40}\)\s*$/i, "")
        .trim(),
    )
    .filter((line) => USER_FACING_COMMIT.test(line))
    .map((line) => {
      const text = line.replace(USER_FACING_COMMIT, "");
      return `- ${text.charAt(0).toUpperCase()}${text.slice(1)}`;
    });
  return bullets.length > 0 ? bullets.join("\n") : null;
}

/** Fill empty release bodies from the commit range since the previous release. Rare fallback. */
export async function fillEmptyBodies(unseen: Release[], all: Release[]): Promise<Release[]> {
  return Promise.all(
    unseen.map(async (release) => {
      if (release.body) return release;
      const idx = all.findIndex((r) => r.version === release.version);
      const previous = all[idx + 1];
      if (!previous) return release;
      const body = await fetchCommitFallback(previous.tag, release.tag);
      return body ? { ...release, body } : release;
    }),
  );
}

async function fetchCommitFallback(baseTag: string, headTag: string): Promise<string | null> {
  const data = (await ghFetch(
    `/compare/${encodeURIComponent(baseTag)}...${encodeURIComponent(headTag)}`,
  )) as { commits?: Array<{ commit?: { message?: string } }> } | null;
  if (!data?.commits) return null;
  const subjects = data.commits
    .map((c) => (typeof c.commit?.message === "string" ? c.commit.message.split("\n")[0] : ""))
    .join("\n");
  return simplifyCommits(subjects);
}

/** Offline fallback for the installed version, from the build-time bundled commit log. */
export function getBundledRelease(version: string): Release | null {
  const notes = bundledReleaseNotes as Record<string, { body?: unknown; htmlUrl?: unknown }>;
  const entry = notes[version] ?? notes[version.replace(/^v/i, "")];
  const raw = typeof entry?.body === "string" ? entry.body : "";
  const body = simplifyCommits(raw);
  if (!body) return null;
  return {
    version,
    tag: `v${version}`,
    body,
    htmlUrl: typeof entry?.htmlUrl === "string" ? entry.htmlUrl : releaseUrl(version),
    publishedAt: null,
  };
}

/** Everything the popup needs for one launch. Empty array = nothing to show. */
export async function loadUnseenReleases(
  installedVersion: string,
  lastSeen: string | null,
): Promise<Release[]> {
  const all = await fetchReleases();
  if (all) {
    const unseen = selectUnseenReleases(all, installedVersion, lastSeen);
    const filled = (await fillEmptyBodies(unseen, all)).filter((r) => r.body);
    if (filled.length > 0) return filled;
  }
  const bundled = getBundledRelease(installedVersion);
  return bundled ? [bundled] : [];
}
