import type { WebSearchProviderId } from "./types";

export type WebSearchProviderDefinition = {
  id: WebSearchProviderId;
  name: string;
  apiKeyPlaceholder: string;
  dashboardUrl: string;
  requiresApiKey: boolean;
};

export const webSearchProviderRegistry = [
  {
    id: "local",
    name: "Local",
    apiKeyPlaceholder: "",
    dashboardUrl: "",
    requiresApiKey: false,
  },
  {
    id: "exa",
    name: "Exa",
    apiKeyPlaceholder: "Enter your Exa API key...",
    dashboardUrl: "https://dashboard.exa.ai",
    requiresApiKey: true,
  },
  {
    id: "ollama",
    name: "Ollama",
    apiKeyPlaceholder: "Enter your Ollama API key...",
    dashboardUrl: "https://ollama.com/settings/keys",
    requiresApiKey: true,
  },
  {
    id: "tavily",
    name: "Tavily",
    apiKeyPlaceholder: "Enter your Tavily API key...",
    dashboardUrl: "https://app.tavily.com",
    requiresApiKey: true,
  },
] as const satisfies readonly WebSearchProviderDefinition[];

export function getWebSearchProvider(id: WebSearchProviderId) {
  return webSearchProviderRegistry.find((provider) => provider.id === id)
    ?? webSearchProviderRegistry[0];
}
