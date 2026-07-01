import { Bot, Globe } from "lucide-react";
import React from "react";
import { getWebSearchWarning } from "@/features/web-search/useWebSearchConfig";
import { useSettingsStore } from "@/store/settingsStore";
import { useAgentStore } from "@/features/agent/agentStore";

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
  experimental?: boolean;
}

export const featureRegistry: FeatureDef[] = [
  {
    id: "poly-agent",
    name: "Poly Agent",
    kind: "toggle",
    description: "Experimental coding agent for inspecting and editing the selected workspace.",
    icon: Bot,
    useIsActive: () => {
      const experimentalEnabled = useSettingsStore((state) => state.general.experimentalFeatures);
      const agentEnabled = useAgentStore((state) => state.enabled);
      return experimentalEnabled && agentEnabled;
    },
    getIsActive: () =>
      useSettingsStore.getState().general.experimentalFeatures &&
      useAgentStore.getState().enabled,
    toggle: () => {
      if (!useSettingsStore.getState().general.experimentalFeatures) return;
      const state = useAgentStore.getState();
      state.actions.setEnabled(!state.enabled);
    },
    experimental: true,
    getWarning: () => "Experimental",
  },
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
];

export function isFeatureAIActive(featureId: string): boolean {
  const feature = featureRegistry.find((item) => item.id === featureId);
  if (!feature) return false;
  return feature.getIsActive();
}

export function useFeatures() {
  const webSearchEnabled = useSettingsStore((state) => state.general.webSearchEnabled);
  const agentEnabled = useAgentStore((state) => state.enabled);
  const experimentalEnabled = useSettingsStore((state) => state.general.experimentalFeatures);

  return featureRegistry
    .filter((feature) => !feature.experimental || experimentalEnabled)
    .map((feature) => {
      let active: boolean;
      if (feature.id === "web_search") active = webSearchEnabled;
      else if (feature.id === "poly-agent") active = experimentalEnabled && agentEnabled;
      else active = feature.getIsActive();
      return { ...feature, active, warning: feature.getWarning?.() };
    });
}
