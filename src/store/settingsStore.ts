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
};

export type BrowserTtsSettings = {
  voiceURI: string;
  speed: number;
  pitch: number;
};

export type TtsSettings = {
  engine: "browser";
  browser: BrowserTtsSettings;
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
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      general: {
        language: "en",
        notifications: true,
        systemPrompt: "",
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
              ...s.tts,
              ...update,
              browser: { ...s.tts.browser, ...(update.browser || {}) },
            },
          })),

        resetAccount: () => set({ account: { ...defaultAccount } }),
        setPromptPreset: (id) => set({ selectedPromptPreset: id }),
      },
    }),
    {
      name: "openbench:settings",
      partialize: (state) => ({
        general: state.general,
        account: state.account,
        tts: state.tts,
        selectedPromptPreset: state.selectedPromptPreset,
      }) as SettingsState,
    },
  ),
);
