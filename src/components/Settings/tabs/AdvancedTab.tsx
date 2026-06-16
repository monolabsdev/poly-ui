import {
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { useShallow } from "zustand/react/shallow";
import { SettingCard, SectionHeader } from "../SettingComponents";
import { useSettingsStore } from "@/store/settingsStore";
import { useAgentStore } from "@/features/agent/agentStore";
import { disableMemoryForOwner } from "@/features/memory/memoryClient";
import { getCurrentProviderAccountId } from "@/services/providers";
export function AdvancedTab() {
  const { general, performance, actions } = useSettingsStore(
    useShallow((state) => ({
      general: state.general,
      performance: state.performance,
      actions: state.actions,
    })),
  );
  const agentEnabled = useAgentStore((state) => state.enabled);
  const setAgentEnabled = useAgentStore((state) => state.actions.setEnabled);

  const handleExperimentalToggle = (checked: boolean) => {
    actions.updateGeneral({ experimentalFeatures: checked });
    if (!checked) {
      setAgentEnabled(false);
      void disableMemoryForOwner(getCurrentProviderAccountId()).catch(() => undefined);
    }
  };

  return (
    <Stack spacing={0}>
      <SectionHeader
        title="Experimental"
        description="Try upcoming features before they're stable."
      />

      <SettingCard
        title="Enable experimental features"
        description="Unlocks in-development features like Poly Agent, memory, and advanced reasoning controls."
        action={
          <Switch
            checked={general.experimentalFeatures}
            onChange={(e) => handleExperimentalToggle(e.target.checked)}
          />
        }
      />

      <SettingCard
        title="Memory"
        description="Persistent memory UI and background processing stay inactive unless experimental features are enabled."
      >
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          Open the Memory tab after enabling experimental features. Turning this switch off disables memory processing for current profile.
        </Typography>
      </SettingCard>

      <SettingCard
        title="Poly Agent"
        description="Experimental agent mode for workspace inspection and file edits."
        action={
          <Switch
            checked={general.experimentalFeatures && agentEnabled}
            disabled={!general.experimentalFeatures}
            onChange={(e) => setAgentEnabled(e.target.checked)}
          />
        }
      >
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          Off by default. Requires explicit tool approvals unless you choose a broader approval preset in chat.
        </Typography>
      </SettingCard>

      <SectionHeader
        title="Performance"
        description="Tune heavier features for this device."
      />

      <SettingCard
        title="Reduce motion"
        description="Minimize animated transitions and loaders."
        action={
          <Switch
            checked={performance.reduceMotion}
            onChange={(e) => actions.updatePerformance({ reduceMotion: e.target.checked })}
          />
        }
      />

      <SettingCard
        title="Reduce transparency"
        description="Prefer solid surfaces over transparent window effects."
        action={
          <Switch
            checked={performance.reduceTransparency}
            onChange={(e) => actions.updatePerformance({ reduceTransparency: e.target.checked })}
          />
        }
      />

    </Stack>
  );
}
