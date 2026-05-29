import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PromptPresetId } from "@/constants/promptPresets";

export type Gender = "male" | "female" | "other" | "prefer-not-to-say";

export type AccountSettings = {
  name: string;
  bio: string;
  gender: Gender;
  birthDate: string;
};

export type GeneralSettings = {
  language: string;
  notifications: boolean;
  systemPrompt: string;
  exaApiKey: string;
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
  account: AccountSettings;
  tts: TtsSettings;
  selectedPromptPreset: PromptPresetId;
  actions: {
    updateGeneral: (update: Partial<GeneralSettings>) => void;
    updateAccount: (update: Partial<AccountSettings>) => void;
    updateTts: (update: Partial<TtsSettings>) => void;
    resetAccount: () => void;
    setPromptPreset: (id: PromptPresetId) => void;
  };
};

const defaultAccount: AccountSettings = {
  name: "",
  bio: "",
  gender: "prefer-not-to-say",
  birthDate: "",
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

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      general: {
        language: "en",
        notifications: true,
        systemPrompt: "",
        exaApiKey: "",
        webSearchEnabled: false,
        reasoningEnabled: false,
      },
      account: { ...defaultAccount },
      tts: { ...defaultTts },
      selectedPromptPreset: "default" as PromptPresetId,
      actions: {
        updateGeneral: (update) =>
          set((s) => ({ general: { ...s.general, ...update } })),

        updateAccount: (update) =>
          set((s) => ({ account: { ...s.account, ...update } })),

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

        resetAccount: () => set({ account: { ...defaultAccount } }),
        setPromptPreset: (id) => set({ selectedPromptPreset: id }),
      },
    }),
    {
      name: "openbench:settings",
      version: 4,
      migrate: (persisted, version) => {
        const state = persisted as any;
        if (!state?.tts) return state as SettingsState;
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
        return state as SettingsState;
      },
      partialize: ({ general, account, tts, selectedPromptPreset }) => ({
        general, account, tts, selectedPromptPreset,
      }) as SettingsState,
    },
  ),
);
