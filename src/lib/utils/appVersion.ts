import { getVersion as getTauriVersion } from "@tauri-apps/api/app";

export function normalizeAppVersion(version: unknown): string | null {
  if (typeof version !== "string") return null;
  const trimmed = version.trim();
  if (!trimmed) return null;
  const normalized = trimmed.replace(/^v/i, "");
  return normalized || null;
}

export function getBundledAppVersion(): string | null {
  try {
    return normalizeAppVersion(__APP_VERSION__);
  } catch {
    return null;
  }
}

export async function getInstalledAppVersion(): Promise<string | null> {
  try {
    const version = normalizeAppVersion(await getTauriVersion());
    if (version) return version;
  } catch {
    // Non-Tauri contexts, tests, and browser preview fall back to the bundled version.
  }

  return getBundledAppVersion();
}
