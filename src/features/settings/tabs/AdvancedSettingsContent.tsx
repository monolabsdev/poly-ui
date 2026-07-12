import { useCallback } from "react";
import { useShallow } from "zustand/react/shallow";
import { Switch } from "@/components/ui/switch";
import { SettingsSection, SettingRow } from "../SettingsShell";
import { useSettingsStore } from "@/store/settingsStore";
import { useAgentStore } from "@/features/agent/agentStore";
import {
  disableMemoryForOwner,
  memoryGetSettings,
  memoryUpdateSettings,
} from "@/features/memory/memoryClient";
import { getCurrentProviderAccountId } from "@/features/providers";

export function AdvancedSettingsContent() {
  const { experimentalFeatures, memoryBeta, actions } = useSettingsStore(
    useShallow((state) => ({
      experimentalFeatures: state.general.experimentalFeatures,
      memoryBeta: state.general.memoryBeta,
      actions: state.actions,
    })),
  );
  const agentEnabled = useAgentStore((state) => state.enabled);
  const setAgentEnabled = useAgentStore((state) => state.actions.setEnabled);

  const handleExperimentalToggle = useCallback((checked: boolean) => {
    actions.updateGeneral({ experimentalFeatures: checked });
    if (!checked) {
      setAgentEnabled(false);
    }
  }, [actions, setAgentEnabled]);

  const handleMemoryToggle = useCallback((checked: boolean) => {
    actions.updateGeneral({ memoryBeta: checked });
    const ownerId = getCurrentProviderAccountId();
    console.info(`[Memory] toggle changed to ${checked}, ownerId="${ownerId}"`);
    if (!checked) {
      void disableMemoryForOwner(ownerId).catch((err) =>
        console.warn("[Memory] disableMemoryForOwner failed", err),
      );
      return;
    }
    void memoryGetSettings(ownerId)
      .then((existing) => {
        console.info("[Memory] existing settings from backend", existing);
        return memoryUpdateSettings({
          ...existing,
          enabled: true,
          automaticExtraction: true,
          ownerId,
        });
      })
      .then((saved) => {
        console.info("[Memory] settings saved to backend", saved);
      })
      .catch((err) => {
        console.error("[Memory] failed to update settings", err);
      });
  }, [actions]);

  return (
    <SettingsSection
      title="Experimental"
      description="Upcoming features before they are stable."
    >
      <SettingRow
        title="Enable experimental features"
        description="Unlocks in-development features like Poly Agent."
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
      <SettingRow
        title="Memory (Beta)"
        description="Remember information across chats. Poly extracts and recalls relevant context automatically."
        action={
          <Switch
            checked={memoryBeta}
            onCheckedChange={handleMemoryToggle}
          />
        }
      >
        <p className="text-sm text-muted-foreground">
          A Memory tab appears in Settings when enabled.
        </p>
      </SettingRow>
    </SettingsSection>
  );
}
