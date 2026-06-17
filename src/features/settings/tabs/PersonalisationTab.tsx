import { Box, ButtonBase, Stack, TextField, Typography } from "@mui/material";
import { Circle } from "lucide-react";
import { SectionHeader, SettingCard } from "../SettingComponents";
import { appTextFieldSx } from "@/components/ui/appDialog";
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

      <Stack spacing={0.5} sx={{ pb: 0.5 }}>
        {PROMPT_PRESETS.map((preset) => {
          const isSelected = selectedPromptPreset === preset.id;
          return (
            <ButtonBase
              key={preset.id}
              onClick={() => actions.setPromptPreset(preset.id)}
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 1.5,
                px: 1.5,
                py: 1.25,
                width: "100%",
                justifyContent: "flex-start",
                textAlign: "left",
                borderRadius: "8px",
                cursor: "pointer",
                bgcolor: isSelected ? "action.selected" : "transparent",
                "&:hover": { bgcolor: isSelected ? "action.selected" : "action.hover" },
              }}
            >
              <Circle
                size={14}
                style={{ marginTop: 3, flexShrink: 0 }}
                fill={isSelected ? "currentColor" : "none"}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography sx={{ fontSize: 13, fontWeight: 600, color: "text.primary" }}>
                  {preset.name}
                </Typography>
                <Typography
                  sx={{
                    fontSize: 11,
                    color: "text.secondary",
                    lineHeight: 1.4,
                    mt: 0.25,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
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
          sx={appTextFieldSx}
        />
      </SettingCard>
    </Stack>
  );
}
