const REPO = "monolabsdev/poly-ui";
const GH_API = "https://api.github.com";
const TIMEOUT_MS = 8_000;

export type ReleaseNotesResult =
  | { ok: true; body: string; htmlUrl: string }
  | { ok: false };

const cache = new Map<string, ReleaseNotesResult>();

export function clearReleaseNotesCache(): void {
  cache.clear();
}

export async function fetchReleaseNotes(version: string): Promise<ReleaseNotesResult> {
  const cached = cache.get(version);
  if (cached) return cached;

  const tags = [`v${version}`, version];
  for (const tag of tags) {
    const result = await tryFetchTag(tag);
    if (result.ok) {
      cache.set(version, result);
      return result;
    }
    if (result !== NOT_FOUND) {
      cache.set(version, result);
      return result;
    }
  }

  cache.set(version, NOT_FOUND);
  return NOT_FOUND;
}

const NOT_FOUND: ReleaseNotesResult = { ok: false };

async function tryFetchTag(tag: string): Promise<ReleaseNotesResult> {
  const url = `${GH_API}/repos/${REPO}/releases/tags/${encodeURIComponent(tag)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/vnd.github+json" },
    });

    if (res.status === 404) return NOT_FOUND;
    if (!res.ok) return { ok: false };

    const data = await res.json();
    if (!data || !data.body) return { ok: false };

    return {
      ok: true,
      body: String(data.body ?? ""),
      htmlUrl: String(data.html_url ?? `https://github.com/${REPO}/releases/tag/${tag}`),
    };
  } catch {
    return { ok: false };
  } finally {
    clearTimeout(timer);
  }
}
