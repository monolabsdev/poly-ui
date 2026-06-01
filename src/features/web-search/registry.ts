import type { WebSearchProviderId } from "./types";

export type WebSearchProviderDefinition = {
  id: WebSearchProviderId;
  name: string;
  apiKeyPlaceholder: string;
  dashboardUrl: string;
};

export const webSearchProviderRegistry = [
  {
    id: "exa",
    name: "Exa",
    apiKeyPlaceholder: "Enter your Exa API key...",
    dashboardUrl: "https://dashboard.exa.ai",
  },
  {
    id: "ollama",
    name: "Ollama",
    apiKeyPlaceholder: "Enter your Ollama API key...",
    dashboardUrl: "https://ollama.com/settings/keys",
  },
  {
    id: "tavily",
    name: "Tavily",
    apiKeyPlaceholder: "Enter your Tavily API key...",
    dashboardUrl: "https://app.tavily.com",
  },
] as const satisfies readonly WebSearchProviderDefinition[];

export function getWebSearchProvider(id: WebSearchProviderId) {
  return webSearchProviderRegistry.find((provider) => provider.id === id)
    ?? webSearchProviderRegistry[0];
}
