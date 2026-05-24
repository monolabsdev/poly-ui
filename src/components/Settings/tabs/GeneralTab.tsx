import {
  FormControl,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
} from "@mui/material";
import { SettingCard, SectionHeader } from "../SettingComponents";
import { appTextFieldSx } from "@/components/ui/appDialog";
import { useSettingsStore } from "@/store/settingsStore";
import { useThemeStore } from "@/store/themeStore";

const selectSx = {
  fontSize: 13,
  fontWeight: 500,
  bgcolor: "transparent",
  color: "text.secondary",
  "& .MuiSelect-select": {
    pr: "32px !important",
    pb: 0.5,
    pt: 0.5,
  },
  "& .MuiOutlinedInput-notchedOutline": { border: "none" },
  "&:hover .MuiOutlinedInput-notchedOutline": { border: "none" },
  "&.Mui-focused .MuiOutlinedInput-notchedOutline": { border: "none" },
  "&:hover": { color: "text.primary" },
} as const;

export function GeneralTab() {
  const { general, actions } = useSettingsStore();
  const { mode, setMode } = useThemeStore();

  return (
    <Stack spacing={0}>
      <SectionHeader title="General" />

      <SettingCard
        title="Theme"
        description="Choose how the interface is rendered."
        action={
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={mode}
              onChange={(e) => setMode(e.target.value as "light" | "dark" | "system")}
              sx={selectSx}
            >
              <MenuItem value="system">System</MenuItem>
              <MenuItem value="light">Light</MenuItem>
              <MenuItem value="dark">Dark</MenuItem>
            </Select>
          </FormControl>
        }
      />

      <SettingCard
        title="Language"
        description="UI language preference."
        action={
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={general.language}
              onChange={(e) => actions.updateGeneral({ language: e.target.value })}
              sx={selectSx}
            >
              <MenuItem value="en">English</MenuItem>
            </Select>
          </FormControl>
        }
      />

      <SettingCard
        title="Notifications"
        description="Show toast notifications for events."
        action={
          <Switch
            checked={general.notifications}
            onChange={(e) => actions.updateGeneral({ notifications: e.target.checked })}
          />
        }
      />

      <SettingCard title="System Prompt">
        <TextField
          value={general.systemPrompt}
          onChange={(e) => actions.updateGeneral({ systemPrompt: e.target.value })}
          placeholder="Enter system prompt here..."
          multiline
          minRows={4}
          maxRows={8}
          fullWidth
          size="small"
          sx={appTextFieldSx}
        />
      </SettingCard>

      <SectionHeader title="Web Search" />

      <SettingCard
        title="Exa API Key"
        description="Required for web search. Get one at https://dashboard.exa.ai"
      >
        <TextField
          value={general.exaApiKey}
          onChange={(e) => actions.updateGeneral({ exaApiKey: e.target.value })}
          placeholder="Enter your Exa API key..."
          type="password"
          fullWidth
          size="small"
          sx={appTextFieldSx}
        />
      </SettingCard>

    </Stack>
  );
}
