import { ollamaClient } from "./client";
import type { OllamaState, OllamaModel } from "./types";
import { useProviderStore } from "../providers";

type StateChangeCallback = (state: OllamaState, models?: OllamaModel[], error?: string) => void;

let pollTimer: number | null = null;
let currentBackoff = 2000;
const MAX_BACKOFF = 30000;

interface HealthMonitorDeps {
  getLocalModels: typeof ollamaClient.getLocalModels;
  refreshProviders: () => Promise<void>;
  getProviderState: () => { providers: Array<{ provider_type: string; status: string }> };
  onOnline?: () => void;
  onOffline?: (error: string) => void;
}

function createHealthMonitor(deps: HealthMonitorDeps) {
  let currentState: OllamaState = "loading";
  const callbacks: Set<StateChangeCallback> = new Set();

  const notify = (state: OllamaState, models?: OllamaModel[], error?: string) => {
    currentState = state;
    callbacks.forEach((cb) => cb(state, models, error));
  };

  const checkHealth = async () => {
    try {
      await deps.refreshProviders();
      const providers = deps.getProviderState().providers;
      const activeProvider = providers.find((p) => p.status === "Online");

      if (!activeProvider) {
        notify("offline", undefined, "No active provider");
        return;
      }

      const models = await deps.getLocalModels();

      if (currentState !== "online") {
        deps.onOnline?.();
        currentBackoff = 2000;
      }

      notify("online", models);
      return { models };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const isProviderError =
        errorMsg.includes("No available LLM providers") ||
        errorMsg.includes("No active provider");

      if (currentState === "online" && !isProviderError) {
        deps.onOffline?.(errorMsg);
      }

      notify(
        isProviderError || currentState === "loading" ? "offline" : "reconnecting",
        undefined,
        errorMsg,
      );

      currentBackoff = isProviderError
        ? 2000
        : Math.min(currentBackoff * 1.5, MAX_BACKOFF);
    }

    if (pollTimer !== null) {
      pollTimer = window.setTimeout(
        checkHealth,
        currentState === "online" ? 10000 : currentBackoff,
      );
    }
  };

  return {
    getState: () => currentState,

    onStateChange(callback: StateChangeCallback): () => void {
      callbacks.add(callback);
      return () => callbacks.delete(callback);
    },

    start() {
      if (pollTimer !== null) return;
      pollTimer = 1;
      void checkHealth();
    },

    stop() {
      if (pollTimer !== null) {
        clearTimeout(pollTimer);
        pollTimer = null;
      }
    },

    async refresh() {
      await checkHealth();
    },
  };
}

export type HealthMonitor = ReturnType<typeof createHealthMonitor>;

let monitor: HealthMonitor | null = null;

export function getHealthMonitor(): HealthMonitor {
  if (!monitor) {
    monitor = createHealthMonitor({
      getLocalModels: ollamaClient.getLocalModels,
      refreshProviders: () => useProviderStore.getState().actions.refresh(),
      getProviderState: () => ({
        providers: useProviderStore.getState().providers,
      }),
    });
  }
  return monitor;
}