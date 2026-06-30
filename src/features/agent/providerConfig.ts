import type { ProviderConfig, ProviderStatusResponse, ProviderType } from "@/features/providers";

export function selectAgentProviderConfig(
  providers: ProviderStatusResponse[],
  provider: ProviderType,
  model: string,
  providerConfigId?: number,
): ProviderConfig | undefined {
  const compatible = providers
    .filter((item) => item.config.provider_type === provider && item.config.enabled)
    .map((item) => item.config);
  if (providerConfigId !== undefined) {
    return compatible.find((config) => config.id === providerConfigId);
  }
  return compatible.find((config) => configHasModel(config, model))
    ?? compatible.find((config) => config.preset && model.toLowerCase().includes(config.preset.toLowerCase()))
    ?? compatible[0];
}

export function configHasModel(config: ProviderConfig, model: string): boolean {
  const suggestions = parseModelSuggestions(config.model_suggestions);
  return suggestions.some((suggestion) => suggestion === model);
}

function parseModelSuggestions(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return raw.split(",").map((item) => item.trim()).filter(Boolean);
  }
}
