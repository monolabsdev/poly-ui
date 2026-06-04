import {
  FormControl,
  MenuItem,
  Select,
  Stack,
  Switch,
} from "@mui/material";
import { useShallow } from "zustand/react/shallow";
import { SettingCard, SectionHeader, selectSx } from "../SettingComponents";
import { useSettingsStore } from "@/store/settingsStore";
import { useThemeStore } from "@/store/themeStore";
import { WebSearchSettings } from "@/features/web-search/WebSearchSettings";

export function GeneralTab() {
  const { general, actions } = useSettingsStore(
    useShallow((state) => ({
      general: state.general,
      actions: state.actions,
    })),
  );
  const { mode, setMode } = useThemeStore(
    useShallow((state) => ({
      mode: state.mode,
      setMode: state.setMode,
    })),
  );

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

      <SectionHeader
        title="Web Search"
        description="Optional live results. Provider credentials stay local."
      />
      <WebSearchSettings />
    </Stack>
  );
}
