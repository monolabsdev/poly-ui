import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

export type ProviderType = "OllamaLocal" | "OllamaAPI" | "Anthropic" | "OpenAI";
export type ProviderStatus = "Online" | "Offline" | "Reconnecting" | "Unavailable";

export interface ProviderConfig {
  provider_type: ProviderType;
  enabled: boolean;
  ollama_host?: string;
  ollama_api_key?: string;
  ollama_api_base_url?: string;
  priority: number;
}

export interface ProviderStatusResponse {
  provider_type: ProviderType;
  status: ProviderStatus;
  config: ProviderConfig;
}

interface ProviderStore {
  providers: ProviderStatusResponse[];
  loading: boolean;
  error: string | null;
  
  actions: {
    refresh: () => Promise<void>;
    updateConfig: (config: ProviderConfig) => Promise<void>;
    refreshHealth: () => Promise<void>;
  };
}

export const useProviderStore = create<ProviderStore>((set, get) => ({
  providers: [],
  loading: false,
  error: null,

  actions: {
    refresh: async () => {
      set({ loading: true });
      try {
        const providers = await invoke<ProviderStatusResponse[]>("get_providers");
        set({ providers, loading: false, error: null });
      } catch (err) {
        set({ error: err as string, loading: false });
      }
    },
    updateConfig: async (config: ProviderConfig) => {
      try {
        await invoke("update_provider_config", { config });
        await get().actions.refresh();
      } catch (err) {
        set({ error: err as string });
      }
    },
    refreshHealth: async () => {
      set({ loading: true });
      try {
        await invoke("refresh_provider_health");
        await get().actions.refresh();
      } catch (err) {
        set({ error: err as string, loading: false });
      }
    }
  }
}));
