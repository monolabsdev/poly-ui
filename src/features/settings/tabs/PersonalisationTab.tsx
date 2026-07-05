import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { PROMPT_PRESETS } from "@/lib/constants/promptPresets";
import { useSettingsStore } from "@/store/settingsStore";
import { useShallow } from "zustand/react/shallow";
import { SettingRow, SettingsSection } from "../SettingsShell";

export function PersonalisationTab() {
  const { general, selectedPromptPreset, actions } = useSettingsStore(
    useShallow((state) => ({
      general: state.general,
      selectedPromptPreset: state.selectedPromptPreset,
      actions: state.actions,
    })),
  );

  return (
    <div className="flex flex-col gap-6">
      <SettingsSection
        title="Prompt Preset"
        description="Choose a default style for AI responses."
      >
        <RadioGroup
          value={selectedPromptPreset}
          onValueChange={(value) =>
            actions.setPromptPreset(value as typeof selectedPromptPreset)
          }
          className="gap-5"
        >
          {PROMPT_PRESETS.map((preset) => (
            <Label
              key={preset.id}
              htmlFor={`preset-${preset.id}`}
              className="flex cursor-pointer items-start gap-3 font-normal"
            >
              <RadioGroupItem
                id={`preset-${preset.id}`}
                value={preset.id}
                className="mt-0.5"
              />
              <div className="flex flex-col gap-1">
                <span className="font-medium text-foreground">{preset.name}</span>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {preset.content}
                </p>
              </div>
            </Label>
          ))}
        </RadioGroup>
      </SettingsSection>

      <SettingsSection
        title="System Prompt"
        description="Custom instructions appended to the selected preset."
      >
        <SettingRow
          title="Custom Prompt"
          description="Applied to every new conversation."
        >
          <Textarea
            aria-label="Custom prompt"
            value={general.systemPrompt}
            onChange={(e) => actions.updateGeneral({ systemPrompt: e.target.value })}
            placeholder="Enter custom instructions..."
            className="min-h-24"
          />
        </SettingRow>
      </SettingsSection>
    </div>
  );
}
