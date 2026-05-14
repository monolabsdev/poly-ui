import { create } from "zustand";
import type { OllamaState, OllamaModel, PullProgress } from "./types";
import { getHealthMonitor } from "./health-monitor";
import { useProviderStore } from "../providers";
import { useNotificationStore } from "@/store/notificationStore";

interface OllamaStore {
  state: OllamaState;
  models: OllamaModel[];
  error: string | null;
  pullingModel: string | null;
  pullProgress: PullProgress | null;
  
  actions: {
    start: () => void;
    stop: () => void;
    refresh: () => Promise<void>;
    setPullingModel: (model: string | null) => void;
    setPullProgress: (progress: PullProgress | null) => void;
  };
}

const healthMonitor = getHealthMonitor();

export const useOllamaStore = create<OllamaStore>((set, get) => {
  // Auto-start the health monitor
  healthMonitor.start();

  healthMonitor.onStateChange((state, models, error) => {
    const prevState = get().state;
    
    if (state === "online" && models) {
      if (prevState !== "online" && prevState !== "loading") {
        const providers = useProviderStore.getState().providers;
        const activeProvider = providers.find(p => p.status === "Online");
        if (activeProvider) {
          useNotificationStore.getState().actions.add({
            type: "success",
            message: `${activeProvider.config.provider_type} Connected`,
            description: `Connection to ${activeProvider.config.provider_type} established.`,
          });
        }
      }
      set({ state, models, error: null });
    } else if (state === "offline" && prevState === "online") {
      useNotificationStore.getState().actions.add({
        type: "error",
        message: "Ollama Offline",
        description: "Connection lost. Attempting to reconnect...",
        duration: 5000,
      });
      set({ state, models: [], error: error ?? null });
    } else {
      set({ state, error: error ?? null });
    }
  });

  return {
    state: "loading",
    models: [],
    error: null,
    pullingModel: null,
    pullProgress: null,

    actions: {
      start: () => {
        healthMonitor.start();
      },
      stop: () => {
        healthMonitor.stop();
      },
      refresh: async () => {
        await healthMonitor.refresh();
      },
      setPullingModel: (model) => set({ pullingModel: model }),
      setPullProgress: (progress) => set({ pullProgress: progress }),
    },
  };
});