import {
  modelChoiceId,
  parseModelChoiceId,
  type ProviderModel,
} from "./model-choice";

export type ModelFilter = "all" | "local" | "external";

export function filterModelOptions<T extends ProviderModel>(
  models: T[],
  filter: ModelFilter,
  query: string,
): T[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();

  return models.filter((model) => {
    const matchesFilter =
      filter === "all" ||
      (filter === "local" && model.provider_type === "OllamaLocal") ||
      (filter === "external" && model.provider_type === "OpenAICompatible");

    return (
      matchesFilter &&
      (!normalizedQuery ||
        model.name.toLocaleLowerCase().includes(normalizedQuery))
    );
  });
}

export function mergeModelOptions<T extends ProviderModel>(
  localModels: T[],
  externalModels: T[],
): T[] {
  const seen = new Set<string>();

  return [...localModels, ...externalModels].filter((model) => {
    const id = modelChoiceId(model.provider_type, model.name);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

export function shouldLoadExternalModels(
  isOpen: boolean,
  isLoaded: boolean,
  isLoading: boolean,
): boolean {
  return isOpen && !isLoaded && !isLoading;
}

export function shouldShowModelLoadingState(
  isLoading: boolean,
  visibleModelCount: number,
): boolean {
  return isLoading && visibleModelCount === 0;
}

export function shouldLoadExternalDefault(
  storedDefault: string,
  isLoaded: boolean,
  isLoading: boolean,
): boolean {
  return (
    parseModelChoiceId(storedDefault)?.provider === "OpenAICompatible" &&
    !isLoaded &&
    !isLoading
  );
}
