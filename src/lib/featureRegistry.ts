import { Globe, Brain } from "lucide-react";
import { useSettingsStore } from "@/store/settingsStore";
import React from "react";

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
}

export const featureRegistry: FeatureDef[] = [
  {
    id: "web_search",
    name: "Web search",
    kind: "forced_toggle",
    description: "Search the web for real-time information",
    icon: Globe,
    useIsActive: () => useSettingsStore((s) => s.general.webSearchEnabled),
    getIsActive: () => useSettingsStore.getState().general.webSearchEnabled,
    toggle: () => {
      const state = useSettingsStore.getState();
      state.actions.updateGeneral({ webSearchEnabled: !state.general.webSearchEnabled });
    }
  },
  {
    id: "reasoning",
    name: "Reasoning",
    kind: "toggle",
    description: "Enable thinking for reasoning models (DeepSeek, Qwen3, GPT-OSS)",
    icon: Brain,
    useIsActive: () => useSettingsStore((s) => s.general.reasoningEnabled),
    getIsActive: () => useSettingsStore.getState().general.reasoningEnabled,
    toggle: () => {
      const state = useSettingsStore.getState();
      state.actions.updateGeneral({ reasoningEnabled: !state.general.reasoningEnabled });
    }
  }
];

export function isFeatureAIActive(featureId: string): boolean {
  const feature = featureRegistry.find((f) => f.id === featureId);
  if (!feature) return false;
  if (feature.kind === "forced_toggle") return true;
  return feature.getIsActive();
}

export function useFeatures() {
  const webSearchEnabled = useSettingsStore((s) => s.general.webSearchEnabled);
  const reasoningEnabled = useSettingsStore((s) => s.general.reasoningEnabled);
  return React.useMemo(
    () => featureRegistry.map((f) => ({ ...f, active: f.getIsActive() })),
    [webSearchEnabled, reasoningEnabled],
  );
}
