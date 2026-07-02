import { useCallback, useEffect, useState } from "react";
import { useSettingsStore } from "@/store/settingsStore";
import { getCurrentProviderAccountId } from "@/features/providers";
import { memoryGetSettings, memoryListForChat } from "./memoryClient";

export function useConversationMemoryCount(conversationId: string | undefined): {
  count: number;
  loading: boolean;
  refresh: () => void;
} {
  const experimentalFeatures = useSettingsStore((state) => state.general.experimentalFeatures);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);
  const refresh = useCallback(() => setRefreshToken((token) => token + 1), []);

  useEffect(() => {
    const ownerId = getCurrentProviderAccountId();
    if (!experimentalFeatures || !ownerId || !conversationId) {
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
  }, [conversationId, experimentalFeatures, refreshToken]);

  return { count, loading, refresh };
}
