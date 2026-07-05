import { useShallow } from "zustand/react/shallow";
import { Switch } from "@/components/ui/switch";
import { SettingsSection, SettingRow } from "../SettingsShell";
import { useSettingsStore } from "@/store/settingsStore";
import { useAgentStore } from "@/features/agent/agentStore";
import { disableMemoryForOwner } from "@/features/memory/memoryClient";
import { getCurrentProviderAccountId } from "@/features/providers";

export function AdvancedSettingsContent() {
  const { experimentalFeatures, actions } = useSettingsStore(
    useShallow((state) => ({
      experimentalFeatures: state.general.experimentalFeatures,
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
    <SettingsSection
      title="Experimental"
      description="Upcoming features before they are stable."
    >
      <SettingRow
        title="Enable experimental features"
        description="Unlocks in-development features like Poly Agent and memory."
        action={
          <Switch
            checked={experimentalFeatures}
            onCheckedChange={handleExperimentalToggle}
          />
        }
      />
      <SettingRow
        title="Poly Agent"
        description="Experimental agent mode for workspace inspection and file edits."
        action={
          <Switch
            checked={experimentalFeatures && agentEnabled}
            disabled={!experimentalFeatures}
            onCheckedChange={setAgentEnabled}
          />
        }
      >
        <p className="text-sm text-muted-foreground">
          Off by default. Requires explicit tool approvals unless you choose a broader approval preset in chat.
        </p>
      </SettingRow>
    </SettingsSection>
  );
}
