import { useEffect, useState, useCallback, useRef } from "react";
import { fetchReleaseNotes, type ReleaseNotesResult } from "./releaseNotesApi";
import { getLastSeenVersion, setLastSeenVersion } from "./releaseNotesStorage";
import { getInstalledAppVersion } from "@/lib/utils/appVersion";

export interface ReleaseNotesState {
  show: boolean;
  loading: boolean;
  data: ReleaseNotesResult | null;
  version: string | null;
  isFirstLaunchForVersion: boolean;
  dismiss: () => void;
}

export function useReleaseNotes(): ReleaseNotesState {
  const [state, setState] = useState<ReleaseNotesState>(() => ({
    show: false,
    loading: true,
    data: null,
    version: null,
    isFirstLaunchForVersion: false,
    dismiss: () => {},
  }));

  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    let cancelled = false;

    void (async () => {
      const currentVersion = await getInstalledAppVersion();
      if (cancelled) return;
      if (!currentVersion) {
        setState((prev) => ({ ...prev, loading: false }));
        return;
      }

      const lastSeen = getLastSeenVersion();
      if (lastSeen === currentVersion) {
        setState((prev) => ({ ...prev, loading: false, version: currentVersion }));
        return;
      }

      const data = await fetchReleaseNotes(currentVersion);
      if (cancelled) return;
      setState((prev) => ({
        ...prev,
        show: true,
        loading: false,
        data,
        version: currentVersion,
        isFirstLaunchForVersion: true,
      }));
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const handler = () => {
      void (async () => {
        const v = await getInstalledAppVersion();
        if (!v) return;
        setState((prev) => ({
          ...prev,
          show: true,
          loading: true,
          data: null,
          version: v,
          isFirstLaunchForVersion: true,
        }));
        const data = await fetchReleaseNotes(v);
        setState((prev) => ({
          ...prev,
          show: true,
          loading: false,
          data,
          version: v,
          isFirstLaunchForVersion: true,
        }));
      })();
    };
    window.addEventListener("force-release-notes", handler);
    return () => window.removeEventListener("force-release-notes", handler);
  }, []);

  const dismiss = useCallback(() => {
    const v = state.version;
    if (v) setLastSeenVersion(v);
    setState((prev) => ({ ...prev, show: false, isFirstLaunchForVersion: false }));
  }, [state.version]);

  return { ...state, dismiss };
}
