import { invoke } from "@tauri-apps/api/core";
import { create } from "zustand";

export type ProviderType = "OllamaLocal";
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
    setProviders: (providers: ProviderStatusResponse[]) => void;
  };
}

export const useProviderStore = create<ProviderStore>((set) => ({
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
    setProviders: (providers) => set({ providers, loading: false, error: null }),
  }
}));
