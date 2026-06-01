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
};

export type BrowserTtsSettings = {
  voiceURI: string;
  speed: number;
  pitch: number;
};

export type StTtsSettings = {
  modelId: string;
  voiceStyle: string;
  speed: number;
};

export type TtsSettings = {
  engine: "browser" | "stTts";
  browser: BrowserTtsSettings;
  stTts: StTtsSettings;
};

type SettingsState = {
  general: GeneralSettings;
  tts: TtsSettings;
  selectedPromptPreset: PromptPresetId;
  actions: {
    updateGeneral: (update: Partial<GeneralSettings>) => void;
    updateTts: (update: Partial<TtsSettings>) => void;
    setPromptPreset: (id: PromptPresetId) => void;
  };
};

const defaultTts: TtsSettings = {
  engine: "browser",
  browser: {
    voiceURI: "",
    speed: 1.0,
    pitch: 1.0,
  },
  stTts: {
    modelId: "Supertone/supertonic-3",
    voiceStyle: "M1",
    speed: 1.0,
  },
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
        webSearchEnabled: true,
        reasoningEnabled: true,
      },
      tts: { ...defaultTts },
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
              stTts: { ...defaultTts.stTts, ...s.tts.stTts, ...(update.stTts ?? {}) },
            },
          })),

        setPromptPreset: (id) => set({ selectedPromptPreset: id }),
      },
    }),
    {
      name: "polyui:settings",
      version: 7,
      migrate: (persisted, version) => {
        const state = persisted as any;
        if (state?.tts) {
          if (version < 1 && state.tts.supertonic) {
            state.tts.stTts = state.tts.supertonic;
            delete state.tts.supertonic;
            if (state.tts.engine === "supertonic") {
              state.tts.engine = "stTts";
            }
          }
          if (version < 2) {
            state.tts.stTts = { ...defaultTts.stTts, ...state.tts.stTts };
            state.tts.browser = { ...defaultTts.browser, ...state.tts.browser };
          }
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
        return state as SettingsState;
      },
      partialize: ({ general, tts, selectedPromptPreset }) => ({
        general, tts, selectedPromptPreset,
      }) as SettingsState,
    },
  ),
);
