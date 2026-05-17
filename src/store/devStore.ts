import { create } from "zustand";

type DevStore = {
  devMode: boolean;
  actions: {
    setDevMode: (on: boolean) => void;
    toggleDevMode: () => void;
  };
};

export const useDevStore = create<DevStore>((set) => ({
  devMode: false,
  actions: {
    setDevMode: (on) => set({ devMode: on }),
    toggleDevMode: () => set((s) => ({ devMode: !s.devMode })),
  },
}));
