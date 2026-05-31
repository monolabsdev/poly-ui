import type { ProviderType } from "@/services/providers";

export type ProviderModel = {
  name: string;
  provider_type: ProviderType;
};

export function modelChoiceId(provider: ProviderType, model: string): string {
  return `${provider}:${encodeURIComponent(model)}`;
}

export function parseModelChoiceId(
  id: string,
): { provider: ProviderType; model: string } | null {
  const separator = id.indexOf(":");
  if (separator < 0) return null;

  const provider = id.slice(0, separator);
  if (provider !== "OllamaLocal" && provider !== "OpenAICompatible") {
    return null;
  }

  try {
    return {
      provider,
      model: decodeURIComponent(id.slice(separator + 1)),
    };
  } catch {
    return null;
  }
}

export function findDefaultModelChoice<T extends ProviderModel>(
  models: T[],
  storedDefault: string,
): T | undefined {
  const parsed = parseModelChoiceId(storedDefault);
  if (parsed) {
    return models.find(
      (model) =>
        model.provider_type === parsed.provider && model.name === parsed.model,
    );
  }

  return models.find((model) => model.name === storedDefault);
}
