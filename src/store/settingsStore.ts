import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OllamaConfig = {
  baseUrl: string;
};

type SettingsState = {
  ollamaConfig: OllamaConfig;
  actions: {
    setOllamaConfig: (config: OllamaConfig) => Promise<void>;
  };
};

const DEFAULT_OLLAMA_CONFIG: OllamaConfig = {
  baseUrl: "http://localhost:11434",
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ollamaConfig: DEFAULT_OLLAMA_CONFIG,
      actions: {
        setOllamaConfig: async (config) => {
          set({ ollamaConfig: config });
        },
      },
    }),
    {
      name: "settings-storage",
      partialize: (state) => ({
        ollamaConfig: state.ollamaConfig,
      }),
    }
  )
);
