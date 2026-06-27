import { useEffect } from "react";
import { findDefaultModelChoice, parseModelChoiceId } from "@/lib/models/model-choice";
import type { ProviderType } from "@/features/providers";

export function useAutoSelectModel({
  online,
  models,
  externalModelsLoaded,
  externalModelsLoading,
  loadExternalModels,
  selectedModelsLength,
  defaultModel,
  setSelectedModel,
}: {
  online: boolean;
  models: { provider_type: ProviderType; name: string }[];
  externalModelsLoaded: boolean;
  externalModelsLoading: boolean;
  loadExternalModels: () => void;
  selectedModelsLength: number;
  defaultModel: string;
  setSelectedModel: (provider: ProviderType, model: string) => void;
}) {
  useEffect(() => {
    if (!online || selectedModelsLength > 0) return;

    const parsedDefault = parseModelChoiceId(defaultModel);
    const isExternalDefault = parsedDefault?.provider === "OpenAICompatible";

    if (isExternalDefault && !externalModelsLoaded) {
      if (!externalModelsLoading) {
        void loadExternalModels();
      }
      return;
    }

    const preferredModel =
      findDefaultModelChoice(models, defaultModel) ?? models[0];
    if (preferredModel) {
      setSelectedModel(preferredModel.provider_type, preferredModel.name);
    }
  }, [
    defaultModel,
    externalModelsLoaded,
    externalModelsLoading,
    loadExternalModels,
    models,
    online,
    selectedModelsLength,
    setSelectedModel,
  ]);
}
