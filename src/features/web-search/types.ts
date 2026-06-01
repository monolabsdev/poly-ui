export type WebSearchProviderId = "exa" | "ollama" | "tavily";

export type WebSearchSettings = {
  provider: WebSearchProviderId;
  apiKeys: Record<WebSearchProviderId, string>;
};

export type WebSearchConfig = {
  provider: WebSearchProviderId;
  apiKey: string;
};
