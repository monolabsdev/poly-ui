import FormControl from "@mui/material/FormControl";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import { appTextFieldSx } from "@/components/ui/appDialog";
import { SettingCard, selectSx } from "@/features/settings/SettingComponents";
import { useSettingsStore } from "@/store/settingsStore";
import { webSearchProviderRegistry } from "./registry";
import type { WebSearchProviderId } from "./types";
import { useWebSearchConfig } from "./useWebSearchConfig";

export function WebSearchSettings() {
  const updateGeneral = useSettingsStore((state) => state.actions.updateGeneral);
  const { apiKey, provider, webSearch } = useWebSearchConfig();

  return (
    <Stack spacing={0}>
      <SettingCard
        title="Web search provider"
        description="Choose provider used for live web results."
        action={
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={provider.id}
              onChange={(event) => {
                updateGeneral({
                  webSearch: {
                    ...webSearch,
                    provider: event.target.value as WebSearchProviderId,
                  },
                });
              }}
              sx={selectSx}
            >
              {webSearchProviderRegistry.map((option) => (
                <MenuItem key={option.id} value={option.id}>{option.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        }
      />

      <SettingCard
        title={`${provider.name} API key`}
        description="Stored locally on this device. Sent only to selected search provider."
      >
        <Stack spacing={0.75}>
          <TextField
            value={apiKey}
            onChange={(event) => {
              updateGeneral({
                webSearch: {
                  ...webSearch,
                  apiKeys: {
                    ...webSearch.apiKeys,
                    [provider.id]: event.target.value,
                  },
                },
              });
            }}
            placeholder={provider.apiKeyPlaceholder}
            type="password"
            autoComplete="off"
            fullWidth
            size="small"
            sx={appTextFieldSx}
          />
          <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
            Need key?{" "}
            <Link href={provider.dashboardUrl} target="_blank" rel="noreferrer">
              Open {provider.name} dashboard
            </Link>
          </Typography>
        </Stack>
      </SettingCard>
    </Stack>
  );
}
