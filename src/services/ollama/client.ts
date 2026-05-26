import { loggedInvoke } from "@/lib/utils";
import type { OllamaModel } from "./types";

import type { ProviderStatusResponse } from "@/services/providers";

interface ProviderAndModelsResult {
  providers: ProviderStatusResponse[];
  models: OllamaModel[];
}

export const ollamaClient = {
  async getLocalModels(): Promise<OllamaModel[]> {
    return loggedInvoke<OllamaModel[]>("get_local_models");
  },

  async getProviderAndModels(): Promise<ProviderAndModelsResult> {
    return loggedInvoke<ProviderAndModelsResult>("get_provider_and_models");
  },

  async deleteModel(model: string): Promise<void> {
    return loggedInvoke("delete_model", { model });
  },

  async cancelPull(): Promise<void> {
    return loggedInvoke("cancel_pull");
  },
};
