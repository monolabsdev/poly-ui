import { FormControl } from "@/components/ui/native-select";
import { Link } from "@/components/ui/link";
import { MenuItem } from "@/components/ui/native-select";
import { Select } from "@/components/ui/native-select";
import { Stack } from "@/components/ui/Stack";
import { TextField } from "@/components/ui/text-field";
import { Typography } from "@/components/ui/Typography";
import { SettingCard, selectClassName } from "@/features/settings/SettingComponents";
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
          <FormControl size="small">
            <Select
              value={provider.id}
              className={selectClassName}
              onChange={(event) => {
                updateGeneral({
                  webSearch: {
                    ...webSearch,
                    provider: event.target.value as WebSearchProviderId,
                  },
                });
              }}
            >
              {webSearchProviderRegistry.map((option) => (
                <MenuItem key={option.id} value={option.id}>{option.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
        }
      />

      {provider.requiresApiKey ? (
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
            />
            <Typography>
              Need key?{" "}
              <Link href={provider.dashboardUrl} target="_blank" rel="noreferrer">
                Open {provider.name} dashboard
              </Link>
            </Typography>
          </Stack>
        </SettingCard>
      ) : (
        <SettingCard
          title="Local search"
          description="Uses bundled Rust HTML providers. No API key or sidecar required."
        />
      )}
    </Stack>
  );
}
