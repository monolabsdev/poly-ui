import type { ProviderType } from "@/features/providers";

export type ProviderModel = {
  name: string;
  provider_type: ProviderType;
  provider_config_id?: number;
};

export type ModelChoice = {
  provider: ProviderType;
  model: string;
  providerConfigId?: number;
};

export function modelChoiceId(
  provider: ProviderType,
  model: string,
  providerConfigId?: number,
): string {
  const encodedModel = encodeURIComponent(model);
  return providerConfigId === undefined
    ? `${provider}:${encodedModel}`
    : `${provider}:${providerConfigId}:${encodedModel}`;
}

export function parseModelChoiceId(
  id: string,
): { provider: ProviderType; model: string; providerConfigId?: number } | null {
  const separator = id.indexOf(":");
  if (separator < 0) return null;

  const provider = id.slice(0, separator);
  if (provider !== "OllamaLocal" && provider !== "OpenAICompatible") {
    return null;
  }

  try {
    const value = id.slice(separator + 1);
    const configSeparator = value.indexOf(":");
    const maybeConfigId = configSeparator < 0 ? Number.NaN : Number(value.slice(0, configSeparator));
    const providerConfigId = Number.isInteger(maybeConfigId) ? maybeConfigId : undefined;
    return {
      provider,
      model: decodeURIComponent(
        providerConfigId === undefined ? value : value.slice(configSeparator + 1),
      ),
      ...(providerConfigId === undefined ? {} : { providerConfigId }),
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
        model.provider_type === parsed.provider &&
        model.name === parsed.model &&
        (parsed.providerConfigId === undefined ||
          model.provider_config_id === parsed.providerConfigId),
    );
  }

  return models.find((model) => model.name === storedDefault);
}
