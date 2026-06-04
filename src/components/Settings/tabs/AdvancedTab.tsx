import {
  Alert,
  Button,
  FormControl,
  MenuItem,
  Select,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { useShallow } from "zustand/react/shallow";
import { SettingCard, SectionHeader, selectSx } from "../SettingComponents";
import { useSettingsStore } from "@/store/settingsStore";
import { choosePerformanceSettings, readSystemProfile } from "@/lib/performance";

export function AdvancedTab() {
  const { performance, actions } = useSettingsStore(
    useShallow((state) => ({
      performance: state.performance,
      actions: state.actions,
    })),
  );
  const hardwareLabel = performance.lastHardwareScan
    ? `${Math.round(performance.lastHardwareScan.totalMemoryMb / 1024)} GB RAM, ${performance.lastHardwareScan.cpuCount} CPU threads`
    : "Not scanned yet";

  const rerunOptimization = async () => {
    const system = await readSystemProfile();
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    actions.updatePerformance({
      autoOptimize: true,
      ...choosePerformanceSettings(system, prefersReducedMotion),
    });
  };

  return (
    <Stack spacing={0}>
      <SectionHeader
        title="Performance"
        description="Startup can tune heavier features for this device."
        action={
          <Button size="small" variant="text" onClick={rerunOptimization}>
            Re-run
          </Button>
        }
      />

      <SettingCard
        title="Auto optimize"
        description="Scan this device on first start and save sensible defaults."
        action={
          <Switch
            checked={performance.autoOptimize}
            onChange={(e) => actions.updatePerformance({ autoOptimize: e.target.checked })}
          />
        }
      >
        <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
          {hardwareLabel}
        </Typography>
      </SettingCard>

      <SettingCard
        title="Profile"
        description="Manual profile for visual and background feature defaults."
        action={
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={performance.profile}
              onChange={(e) => actions.updatePerformance({ profile: e.target.value as typeof performance.profile })}
              sx={selectSx}
            >
              <MenuItem value="auto">Auto</MenuItem>
              <MenuItem value="low">Low</MenuItem>
              <MenuItem value="balanced">Balanced</MenuItem>
              <MenuItem value="high">High</MenuItem>
            </Select>
          </FormControl>
        }
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

      <SettingCard
        title="Dictation"
        description="Keep off on low-memory systems. Requires a dictation-enabled build."
        action={
          <Switch
            checked={performance.dictationEnabled}
            onChange={(e) => actions.updatePerformance({ dictationEnabled: e.target.checked })}
          />
        }
      >
        <Alert severity="warning" variant="outlined" sx={{ fontSize: 12 }}>
          Changes to dictation only take effect after restarting the app.
        </Alert>
      </SettingCard>
    </Stack>
  );
}
