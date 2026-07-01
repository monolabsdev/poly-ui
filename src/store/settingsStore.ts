import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PromptPresetId } from "@/lib/constants/promptPresets";
import type { WebSearchSettings } from "@/features/web-search/types";
import { startupError, startupPhase } from "@/lib/utils/startupDiagnostics";
import { createSafeJsonStorage } from "./persistStorage";

export type GeneralSettings = {
  language: string;
  notifications: boolean;
  systemPrompt: string;
  webSearch: WebSearchSettings;
  webSearchEnabled: boolean;
  experimentalFeatures: boolean;
  showModelInEmptyState: boolean;
};

export type BrowserTtsSettings = {
  voiceURI: string;
  speed: number;
  pitch: number;
};

export type TtsSettings = {
  browser: BrowserTtsSettings;
};

export type DictationSettings = {
  enabled: boolean;
  language: string;
  autoStart: boolean;
};

export type PerformanceSettings = {
  reduceMotion: boolean;
  reduceTransparency: boolean;
  appZoom: number;
};

type SettingsState = {
  general: GeneralSettings;
  tts: TtsSettings;
  dictation: DictationSettings;
  performance: PerformanceSettings;
  selectedPromptPreset: PromptPresetId;
  actions: {
    updateGeneral: (update: Partial<GeneralSettings>) => void;
    updateTts: (update: Partial<TtsSettings>) => void;
    updateDictation: (update: Partial<DictationSettings>) => void;
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

const SETTINGS_VERSION = 14;

export const defaultDictation: DictationSettings = {
  enabled: true,
  language: "en",
  autoStart: false,
};

export const defaultPerformance: PerformanceSettings = {
  reduceMotion: false,
  reduceTransparency: false,
  appZoom: 1,
};

function createDefaultWebSearchSettings(): WebSearchSettings {
  return {
    provider: "exa",
    apiKeys: { exa: "", ollama: "", tavily: "" },
  };
}

function defaultSettingsState(): Omit<SettingsState, "actions"> {
  return {
    general: {
      language: "en",
      notifications: true,
      systemPrompt: "",
      webSearch: createDefaultWebSearchSettings(),
      webSearchEnabled: false,
      experimentalFeatures: false,
      showModelInEmptyState: false,
    },
    tts: { ...defaultTts },
    dictation: { ...defaultDictation },
    performance: { ...defaultPerformance },
    selectedPromptPreset: "default" as PromptPresetId,
  };
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettingsState(),
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

        updateDictation: (update) =>
          set((s) => ({ dictation: { ...s.dictation, ...update } })),

        updatePerformance: (update) =>
          set((s) => ({ performance: { ...s.performance, ...update } })),

        setPromptPreset: (id) => set({ selectedPromptPreset: id }),
      },
    }),
    {
      name: "polyui:settings",
      version: SETTINGS_VERSION,
      storage: createSafeJsonStorage<SettingsState>(),
      migrate: (persisted, version) => {
        startupPhase(`settings migration start: ${version} -> ${SETTINGS_VERSION}`);
        if (version > SETTINGS_VERSION) {
          startupError(`settings future version ${version}; using defaults`);
          return defaultSettingsState() as SettingsState;
        }
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
        }
        if (version < 11 && state?.performance) {
          delete state.performance.autoOptimize;
          delete state.performance.profile;
          delete state.performance.lastHardwareScan;
          delete state.performance.optimizedAt;
        }
        if (version < 12) {
          state.dictation = { ...defaultDictation, ...state.dictation };
        }
        if (version < 13) {
          state.performance = { ...defaultPerformance, ...state.performance };
        }
        if (version < 14 && state?.general) {
          state.general.showModelInEmptyState = false;
        }
        startupPhase("settings migration complete");
        return state as SettingsState;
      },
      onRehydrateStorage: () => {
        startupPhase("settings hydrate begin");
        return (_state, error) => {
          if (error) {
            startupError("settings hydrate failed", error);
          } else {
            startupPhase("settings hydrate complete");
          }
        };
      },
      partialize: ({ general, tts, dictation, performance, selectedPromptPreset }) => ({
        general, tts, dictation, performance, selectedPromptPreset,
      }) as SettingsState,
    },
  ),
);
