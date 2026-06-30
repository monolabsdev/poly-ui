import { loggedInvoke, getSessionToken } from "@/lib/utils/utils";
import type { OllamaModel } from "./types";

import type {
  ProviderStatusResponse,
  ProviderType,
} from "@/features/providers";
import { getCurrentProviderAccountId } from "@/features/providers";

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
      token: getSessionToken(),
    });
  },

  async getProviderModels(providerType: ProviderType): Promise<OllamaModel[]> {
    return loggedInvoke<OllamaModel[]>("get_provider_models", {
      providerType,
      accountId: getCurrentProviderAccountId(),
      token: getSessionToken(),
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
