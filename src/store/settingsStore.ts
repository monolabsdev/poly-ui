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

type SettingsState = {
  general: GeneralSettings;
  account: AccountSettings;
  selectedPromptPreset: PromptPresetId;
  actions: {
    updateGeneral: (update: Partial<GeneralSettings>) => void;
    updateAccount: (update: Partial<AccountSettings>) => void;
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

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      general: {
        language: "en",
        notifications: true,
        systemPrompt: "",
      },
      account: { ...defaultAccount },
      selectedPromptPreset: "default" as PromptPresetId,
      actions: {
        updateGeneral: (update) =>
          set((s) => ({ general: { ...s.general, ...update } })),

        updateAccount: (update) =>
          set((s) => ({ account: { ...s.account, ...update } })),
        resetAccount: () => set({ account: { ...defaultAccount } }),
        setPromptPreset: (id) => set({ selectedPromptPreset: id }),
      },
    }),
    {
      name: "openbench:settings",
      partialize: (state) => ({
        general: state.general,
        account: state.account,
        selectedPromptPreset: state.selectedPromptPreset,
      }),
    },
  ),
);
