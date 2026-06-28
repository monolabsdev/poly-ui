import { FormControl } from "@/components/ui/native-select";
import { MenuItem } from "@/components/ui/native-select";
import { Select } from "@/components/ui/native-select";
import { Stack } from "@/components/ui/Stack";
import { Switch } from "@/components/ui/switch";
import { useShallow } from "zustand/react/shallow";
import { SettingCard, SectionHeader, selectClassName } from "../SettingComponents";
import { useSettingsStore } from "@/store/settingsStore";
import { useThemeStore } from "@/store/themeStore";

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
          <FormControl size="small">
            <Select
              value={mode}
              className={selectClassName}
              onChange={(e) => setMode(e.target.value as "light" | "dark" | "system")}
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
          <FormControl size="small">
            <Select
              value={general.language}
              className={selectClassName}
              onChange={(e) => actions.updateGeneral({ language: e.target.value })}
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
    </Stack>
  );
}
