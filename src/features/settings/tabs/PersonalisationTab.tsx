import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { PROMPT_PRESETS } from "@/lib/constants/promptPresets";
import { useSettingsStore } from "@/store/settingsStore";
import { useShallow } from "zustand/react/shallow";

export function PersonalisationTab() {
  const { general, selectedPromptPreset, actions } = useSettingsStore(
    useShallow((state) => ({
      general: state.general,
      selectedPromptPreset: state.selectedPromptPreset,
      actions: state.actions,
    })),
  );

  return (
    <div>
      <div>
        <h3 className="text-sm font-bold text-foreground">Prompt Preset</h3>
        <p className="text-sm text-muted-foreground">
          Choose a default style for AI responses.
        </p>
      </div>

      <RadioGroup
        value={selectedPromptPreset}
        onValueChange={(value) =>
          actions.setPromptPreset(value as typeof selectedPromptPreset)
        }
        className="mt-4 gap-5"
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
            <div className="space-y-1">
              <span className="font-medium text-foreground">{preset.name}</span>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {preset.content}
              </p>
            </div>
          </Label>
        ))}
      </RadioGroup>

      <Separator className="mt-8" />

      <div className="mt-8">
        <h3 className="text-sm font-bold text-foreground">System Prompt</h3>
        <p className="text-sm text-muted-foreground">
          Custom instructions appended to the selected preset.
        </p>
      </div>

      <div className="mt-4 rounded-xl border border-border/60 p-4">
        <Label htmlFor="custom-prompt" className="font-medium text-foreground">
          Custom Prompt
        </Label>
        <Textarea
          id="custom-prompt"
          value={general.systemPrompt}
          onChange={(e) => actions.updateGeneral({ systemPrompt: e.target.value })}
          placeholder="Enter custom instructions..."
          className="mt-2 min-h-24"
        />
      </div>
    </div>
  );
}
