import { useEffect, useState, useCallback, useRef } from "react";
import { loadUnseenReleases, type Release } from "./releaseNotesApi";
import { getLastSeenVersion, setLastSeenVersion } from "./releaseNotesStorage";
import { getInstalledAppVersion, compareAppVersions } from "@/lib/utils/appVersion";

export interface ReleaseNotesState {
  show: boolean;
  loading: boolean;
  releases: Release[];
  dismiss: () => void;
}

export function useReleaseNotes(): ReleaseNotesState {
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(true);
  const [releases, setReleases] = useState<Release[]>([]);
  const versionRef = useRef<string | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    let cancelled = false;

    void (async () => {
      const installed = await getInstalledAppVersion();
      if (cancelled) return;
      versionRef.current = installed;
      if (!installed) {
        setLoading(false);
        return;
      }

      const lastSeen = getLastSeenVersion();
      if (lastSeen && compareAppVersions(lastSeen, installed) >= 0) {
        setLoading(false);
        return;
      }

      const unseen = await loadUnseenReleases(installed, lastSeen);
      if (cancelled) return;
      setLoading(false);
      if (unseen.length > 0) {
        setReleases(unseen);
        setShow(true);
      }
      // Nothing loadable: stay hidden and retry on next launch.
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Settings "Test Release Notes" button.
  useEffect(() => {
    const handler = () => {
      void (async () => {
        const installed = await getInstalledAppVersion();
        if (!installed) return;
        versionRef.current = installed;
        setShow(true);
        setLoading(true);
        const unseen = await loadUnseenReleases(installed, null);
        setReleases(unseen);
        setLoading(false);
      })();
    };
    window.addEventListener("force-release-notes", handler);
    return () => window.removeEventListener("force-release-notes", handler);
  }, []);

  const dismiss = useCallback(() => {
    if (versionRef.current) setLastSeenVersion(versionRef.current);
    setShow(false);
  }, []);

  return { show, loading, releases, dismiss };
}
