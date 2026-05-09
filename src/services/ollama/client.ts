import { loggedInvoke } from "@/lib/utils";
import type { OllamaModel } from "./types";

export const ollamaClient = {
  /**
   * Fetches local models. Acts as a health check.
   */
  async getLocalModels(): Promise<OllamaModel[]> {
    return loggedInvoke<OllamaModel[]>("get_local_models");
  },

  /**
   * Deletes a model from the local Ollama instance.
   */
  async deleteModel(model: string): Promise<void> {
    return loggedInvoke("delete_model", { model });
  },

  /**
   * Cancels an ongoing pull operation.
   */
  async cancelPull(): Promise<void> {
    return loggedInvoke("cancel_pull");
  },
};
