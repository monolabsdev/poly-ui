import { Globe, Brain } from "lucide-react";
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
  },
  {
    id: "reasoning",
    name: "Reasoning",
    description: "Enable thinking for reasoning models (DeepSeek, Qwen3, GPT-OSS)",
    icon: Brain,
    useIsActive: () => useSettingsStore((s) => s.general.reasoningEnabled),
    toggle: () => {
      const state = useSettingsStore.getState();
      state.actions.updateGeneral({ reasoningEnabled: !state.general.reasoningEnabled });
    }
  }
];

export function useFeatures() {
  const webSearchActive = useSettingsStore((s) => s.general.webSearchEnabled);
  const reasoningActive = useSettingsStore((s) => s.general.reasoningEnabled);

  return React.useMemo(
    () => [
      { ...featureRegistry[0], active: webSearchActive },
      { ...featureRegistry[1], active: reasoningActive },
    ],
    [reasoningActive, webSearchActive],
  );
}
