import { Box } from "@/components/ui/Box";
import { ButtonBase } from "@/components/ui/button-base";
import { Stack } from "@/components/ui/Stack";
import { TextField } from "@/components/ui/text-field";
import { Typography } from "@/components/ui/Typography";
import { Circle } from "lucide-react";
import { SectionHeader, SettingCard } from "../SettingComponents";
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
    <Stack spacing={0}>
      <SectionHeader
        title="Prompt Preset"
        description="Choose a default style for AI responses."
      />

      <Stack spacing={0.5}>
        {PROMPT_PRESETS.map((preset) => {
          const isSelected = selectedPromptPreset === preset.id;
          return (
            <ButtonBase
              key={preset.id}
              onClick={() => actions.setPromptPreset(preset.id)}
            >
              <Circle
                size={14}
                style={{ marginTop: 3, flexShrink: 0 }}
                fill={isSelected ? "currentColor" : "none"}
              />
              <Box>
                <Typography>
                  {preset.name}
                </Typography>
                <Typography
                >
                  {preset.content}
                </Typography>
              </Box>
            </ButtonBase>
          );
        })}
      </Stack>

      <SectionHeader
        title="System Prompt"
        description="Custom instructions appended to the selected preset."
      />

      <SettingCard title="Custom Prompt">
        <TextField
          value={general.systemPrompt}
          onChange={(e) => actions.updateGeneral({ systemPrompt: e.target.value })}
          placeholder="Enter custom instructions..."
          multiline
          minRows={4}
          maxRows={8}
          fullWidth
          size="small"
        />
      </SettingCard>
    </Stack>
  );
}
