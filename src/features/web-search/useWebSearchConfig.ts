import { useSettingsStore } from "@/store/settingsStore";
import { getWebSearchProvider } from "./registry";
import type { WebSearchConfig } from "./types";

export function getWebSearchConfig(): WebSearchConfig | undefined {
  const { webSearch } = useSettingsStore.getState().general;
  const apiKey = webSearch.apiKeys[webSearch.provider]?.trim();
  if (!apiKey) return undefined;
  return { provider: webSearch.provider, apiKey };
}

export function getWebSearchWarning(): string | undefined {
  const { webSearch } = useSettingsStore.getState().general;
  if (getWebSearchConfig()) return undefined;
  return `${getWebSearchProvider(webSearch.provider).name} API key not configured - web search requires an API key`;
}

export function useWebSearchConfig() {
  const webSearch = useSettingsStore((state) => state.general.webSearch);
  const provider = getWebSearchProvider(webSearch.provider);
  const apiKey = webSearch.apiKeys[webSearch.provider] ?? "";
  return { apiKey, provider, webSearch };
}
