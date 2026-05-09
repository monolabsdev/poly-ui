import { create } from "zustand";
import { ollamaClient } from "./client";
import type { OllamaState, OllamaModel, PullProgress } from "./types";
import { useNotificationStore } from "@/store/notificationStore";
import { useProviderStore } from "../providers";

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

let pollTimer: number | null = null;
let currentBackoff = 2000;
const MAX_BACKOFF = 30000;

export const useOllamaStore = create<OllamaStore>((set, get) => {
  const checkHealth = async () => {
    try {
      // First refresh provider status from backend
      await useProviderStore.getState().actions.refresh();
      const providers = useProviderStore.getState().providers;
      console.log("[Monitor] Refreshed providers:", providers.map(p => ({ type: p.provider_type, status: p.status })));
      const activeProvider = providers.find(p => p.status === "Online");
      
      if (activeProvider) {
        const models = await ollamaClient.getLocalModels();
        const prev = get();
        
        if (prev.state !== "online") {
          if (prev.state === "offline" || prev.state === "reconnecting") {
            useNotificationStore.getState().actions.add({
              type: "success",
              message: `${activeProvider.config.provider_type} Connected`,
              description: `Connection to ${activeProvider.config.provider_type} established.`,
            });
          }
          set({ state: "online", error: null, models });
          currentBackoff = 2000; 
        } else {
          set({ models }); 
        }
      } else {
        set({ state: "offline", error: "No active provider", models: [] });
      }
    } catch (err) {
      const errorMsg = typeof err === "string" ? err : (err as Error).message;
      const prev = get();
      
      const isProviderError = errorMsg.includes("No available LLM providers") || errorMsg.includes("No active provider");

      if (prev.state === "online" && !isProviderError) {
        useNotificationStore.getState().actions.add({
          type: "error",
          message: "Ollama Offline",
          description: "Connection lost. Attempting to reconnect...",
          duration: 5000,
        });
      }
      
      set({ 
        state: isProviderError ? "offline" : (prev.state === "loading" ? "offline" : "reconnecting"), 
        error: errorMsg 
      });
      
      currentBackoff = isProviderError ? 2000 : Math.min(currentBackoff * 1.5, MAX_BACKOFF);
    }

    // Schedule next poll
    if (pollTimer !== null) {
      pollTimer = window.setTimeout(checkHealth, get().state === "online" ? 10000 : currentBackoff);
    }
  };

  return {
    state: "loading",
    models: [],
    error: null,
    pullingModel: null,
    pullProgress: null,

    actions: {
      start: () => {
        if (pollTimer !== null) return;
        pollTimer = 1; // Mark active
        void checkHealth();
      },
      stop: () => {
        if (pollTimer !== null) {
          clearTimeout(pollTimer);
          pollTimer = null;
        }
      },
      refresh: async () => {
        await checkHealth();
      },
      setPullingModel: (model) => set({ pullingModel: model }),
      setPullProgress: (progress) => set({ pullProgress: progress }),
    },
  };
});
