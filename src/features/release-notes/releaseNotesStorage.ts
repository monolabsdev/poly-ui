import { normalizeAppVersion } from "@/lib/utils/appVersion";

const STORAGE_KEY = "polyui.releaseNotes.lastSeenVersion";

export function getLastSeenVersion(): string | null {
  try {
    return normalizeAppVersion(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

export function setLastSeenVersion(version: string): void {
  try {
    const normalized = normalizeAppVersion(version);
    if (normalized) localStorage.setItem(STORAGE_KEY, normalized);
  } catch {
    // storage unavailable
  }
}
