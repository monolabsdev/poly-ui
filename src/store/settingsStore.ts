import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PromptPresetId } from "@/constants/promptPresets";
import type { WebSearchSettings } from "@/features/web-search/types";

export type GeneralSettings = {
  language: string;
  notifications: boolean;
  systemPrompt: string;
  webSearch: WebSearchSettings;
  webSearchEnabled: boolean;
  reasoningEnabled: boolean;
  experimentalFeatures: boolean;
};

export type BrowserTtsSettings = {
  voiceURI: string;
  speed: number;
  pitch: number;
};

export type TtsSettings = {
  browser: BrowserTtsSettings;
};

export type PerformanceSettings = {
  reduceMotion: boolean;
  reduceTransparency: boolean;
};

type SettingsState = {
  general: GeneralSettings;
  tts: TtsSettings;
  performance: PerformanceSettings;
  selectedPromptPreset: PromptPresetId;
  actions: {
    updateGeneral: (update: Partial<GeneralSettings>) => void;
    updateTts: (update: Partial<TtsSettings>) => void;
    updatePerformance: (update: Partial<PerformanceSettings>) => void;
    setPromptPreset: (id: PromptPresetId) => void;
  };
};

const defaultTts: TtsSettings = {
  browser: {
    voiceURI: "",
    speed: 1.0,
    pitch: 1.0,
  },
};

export const defaultPerformance: PerformanceSettings = {
  reduceMotion: false,
  reduceTransparency: false,
};

function createDefaultWebSearchSettings(): WebSearchSettings {
  return {
    provider: "exa",
    apiKeys: { exa: "", ollama: "", tavily: "" },
  };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      general: {
        language: "en",
        notifications: true,
        systemPrompt: "",
        webSearch: createDefaultWebSearchSettings(),
        webSearchEnabled: false,
        reasoningEnabled: false,
        experimentalFeatures: false,
      },
      tts: { ...defaultTts },
      performance: { ...defaultPerformance },
      selectedPromptPreset: "default" as PromptPresetId,
      actions: {
        updateGeneral: (update) =>
          set((s) => ({ general: { ...s.general, ...update } })),

        updateTts: (update) =>
          set((s) => ({
            tts: {
              ...defaultTts,
              ...s.tts,
              ...update,
              browser: { ...defaultTts.browser, ...s.tts.browser, ...(update.browser ?? {}) },
            },
          })),

        updatePerformance: (update) =>
          set((s) => ({ performance: { ...s.performance, ...update } })),

        setPromptPreset: (id) => set({ selectedPromptPreset: id }),
      },
    }),
    {
      name: "polyui:settings",
      version: 11,
      migrate: (persisted, version) => {
        const state = persisted as any;
        if (state?.tts) {
          state.tts = {
            browser: { ...defaultTts.browser, ...state.tts.browser },
          };
        }
        if (version < 5) {
          delete state.account;
        }
        if (version < 6 && state?.general) {
          const webSearch = createDefaultWebSearchSettings();
          webSearch.apiKeys.exa = state.general.exaApiKey ?? "";
          state.general.webSearch = webSearch;
          delete state.general.exaApiKey;
        }
        if (version < 7 && state?.general?.webSearch) {
          state.general.webSearch.apiKeys = {
            ...state.general.webSearch.apiKeys,
            ollama: "",
          };
        }
        if (version < 9) {
          state.performance = { ...defaultPerformance, ...state.performance };
        }
        if (version < 10 && state?.general) {
          state.general.experimentalFeatures = Boolean(state.general.experimentalFeatures);
          state.general.reasoningEnabled = Boolean(state.general.reasoningEnabled);
        }
        if (version < 11 && state?.performance) {
          delete state.performance.autoOptimize;
          delete state.performance.profile;
          delete state.performance.lastHardwareScan;
          delete state.performance.optimizedAt;
        }
        return state as SettingsState;
      },
      partialize: ({ general, tts, performance, selectedPromptPreset }) => ({
        general, tts, performance, selectedPromptPreset,
      }) as SettingsState,
    },
  ),
);
