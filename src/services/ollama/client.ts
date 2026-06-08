import { loggedInvoke } from "@/lib/utils";
import type { OllamaModel } from "./types";

import type {
  ProviderStatusResponse,
  ProviderType,
} from "@/services/providers";
import { getCurrentProviderAccountId } from "@/services/providers";

interface ProviderAndModelsResult {
  providers: ProviderStatusResponse[];
  models: OllamaModel[];
}

export const ollamaClient = {
  async getLocalModels(): Promise<OllamaModel[]> {
    return loggedInvoke<OllamaModel[]>("get_local_models", {
      accountId: getCurrentProviderAccountId(),
    });
  },

  async getProviderAndModels(): Promise<ProviderAndModelsResult> {
    return loggedInvoke<ProviderAndModelsResult>("get_provider_and_models", {
      accountId: getCurrentProviderAccountId(),
    });
  },

  async getProviderModels(providerType: ProviderType): Promise<OllamaModel[]> {
    return loggedInvoke<OllamaModel[]>("get_provider_models", {
      providerType,
      accountId: getCurrentProviderAccountId(),
    });
  },

  async deleteModel(model: string): Promise<void> {
    return loggedInvoke("delete_model", {
      model,
      accountId: getCurrentProviderAccountId(),
    });
  },

  async cancelPull(): Promise<void> {
    return loggedInvoke("cancel_pull");
  },
};
