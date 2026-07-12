import { useCallback, useEffect, useState } from "react";
import { useSettingsStore } from "@/store/settingsStore";
import { getCurrentProviderAccountId } from "@/features/providers";
import { memoryGetSettings, memoryListForChat } from "./memoryClient";

/** Fired whenever memories change (extraction, delete, clear) so mounted
 * memory UI refreshes without a remount. */
export const MEMORY_UPDATED_EVENT = "polyui:memory-updated";

export function notifyMemoryUpdated() {
  window.dispatchEvent(new CustomEvent(MEMORY_UPDATED_EVENT));
}

export function useConversationMemoryCount(conversationId: string | undefined): {
  count: number;
  loading: boolean;
  refresh: () => void;
} {
  const memoryBeta = useSettingsStore((state) => state.general.memoryBeta);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const refresh = useCallback(() => setRefreshToken((token) => token + 1), []);

  useEffect(() => {
    window.addEventListener(MEMORY_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(MEMORY_UPDATED_EVENT, refresh);
  }, [refresh]);

  useEffect(() => {
    const ownerId = getCurrentProviderAccountId();
    if (!memoryBeta || !ownerId || !conversationId) {
      setCount(0);
      return;
    }
    let cancelled = false;
    setLoading(true);
    memoryGetSettings(ownerId)
      .then((settings) =>
        settings.enabled ? memoryListForChat(ownerId, conversationId) : [],
      )
      .then((records) => !cancelled && setCount(records.length))
      .catch(() => !cancelled && setCount(0))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [conversationId, memoryBeta, refreshToken]);

  return { count, loading, refresh };
}
