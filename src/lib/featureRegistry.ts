import { Brain, Globe } from "lucide-react";
import React from "react";
import { getWebSearchWarning } from "@/features/web-search/useWebSearchConfig";
import { useSettingsStore } from "@/store/settingsStore";

export type FeatureKind = "toggle" | "forced_toggle";

export interface FeatureDef {
  id: string;
  name: string;
  description?: string;
  kind: FeatureKind;
  icon: React.ElementType;
  useIsActive: () => boolean;
  getIsActive: () => boolean;
  toggle: () => void;
  getWarning?: () => string | undefined;
}

export const featureRegistry: FeatureDef[] = [
  {
    id: "web_search",
    name: "Web search",
    kind: "forced_toggle",
    description: "Search the web for real-time information",
    icon: Globe,
    useIsActive: () => useSettingsStore((state) => state.general.webSearchEnabled),
    getIsActive: () => useSettingsStore.getState().general.webSearchEnabled,
    toggle: () => {
      const state = useSettingsStore.getState();
      state.actions.updateGeneral({ webSearchEnabled: !state.general.webSearchEnabled });
    },
    getWarning: getWebSearchWarning,
  },
  {
    id: "reasoning",
    name: "Reasoning",
    kind: "toggle",
    description: "Enable thinking for reasoning models (DeepSeek, Qwen3, GPT-OSS)",
    icon: Brain,
    useIsActive: () => useSettingsStore((state) => state.general.reasoningEnabled),
    getIsActive: () => useSettingsStore.getState().general.reasoningEnabled,
    toggle: () => {
      const state = useSettingsStore.getState();
      state.actions.updateGeneral({ reasoningEnabled: !state.general.reasoningEnabled });
    },
  },
];

export function isFeatureAIActive(featureId: string): boolean {
  const feature = featureRegistry.find((item) => item.id === featureId);
  if (!feature) return false;
  return feature.getIsActive();
}

export function useFeatures() {
  const webSearchEnabled = useSettingsStore((state) => state.general.webSearchEnabled);
  const webSearch = useSettingsStore((state) => state.general.webSearch);
  const reasoningEnabled = useSettingsStore((state) => state.general.reasoningEnabled);
  return React.useMemo(
    () => featureRegistry.map((feature) => ({
      ...feature,
      active: feature.getIsActive(),
      warning: feature.getWarning?.(),
    })),
    [reasoningEnabled, webSearch, webSearchEnabled],
  );
}
