import { Globe } from "lucide-react";
import { useSettingsStore } from "@/store/settingsStore";
import React from "react";

export interface FeatureDef {
  id: string;
  name: string;
  description?: string;
  icon: React.ElementType;
  useIsActive: () => boolean;
  toggle: () => void;
}

export const featureRegistry: FeatureDef[] = [
  {
    id: "web_search",
    name: "Web search",
    description: "Search the web for real-time information",
    icon: Globe,
    useIsActive: () => useSettingsStore((s) => s.general.webSearchEnabled),
    toggle: () => {
      const state = useSettingsStore.getState();
      state.actions.updateGeneral({ webSearchEnabled: !state.general.webSearchEnabled });
    }
  }
];

export function useFeatures() {
  // Since the registry is static, we can call these hooks in order.
  // If the registry becomes dynamic, we will need a central store instead of individual hooks.
  const activeStates = featureRegistry.map(f => f.useIsActive());
  
  return featureRegistry.map((feature, i) => ({
    ...feature,
    active: activeStates[i]
  }));
}

