import { useState, useEffect } from "react";
import { Stack, TextField, Switch, Button, Typography } from "@mui/material";
import { SettingCard, SectionHeader, Badge } from "../SettingComponents";
import { appTextFieldSx } from "@/components/ui/appDialog";
import { useProviderStore, type ProviderStatus } from "@/services/providers";
import { useNotify } from "@/hooks/useNotify";
import { invoke } from "@tauri-apps/api/core";

const statusColor: Record<ProviderStatus, string> = {
  Online: "#22c55e",
  Offline: "#ef4444",
  Reconnecting: "#f59e0b",
  Unavailable: "#6b7280",
};

export function ProviderTab() {
  const notify = useNotify();
  const { providers, loading, error, actions } = useProviderStore();

  const provider = providers[0];
  const config = provider?.config;
  const status = provider?.status;

  const [host, setHost] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    actions.refresh();
  }, [actions]);

  useEffect(() => {
    if (config) {
      setHost(config.ollama_host ?? "http://127.0.0.1:11434");
      setEnabled(config.enabled);
      setDirty(false);
    }
  }, [config]);

  const handleSave = async () => {
    if (!config) return;
    setSaving(true);
    try {
      await actions.updateProviderConfig({
        provider_type: config.provider_type,
        ollama_host: host,
        enabled,
      });
      setDirty(false);
      notify.success("Provider settings saved");
    } catch (err) {
      notify.error("Failed to save", err as string);
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    setTesting(true);
    try {
      const result = await invoke<{ provider_type: string; status: string }[]>("get_providers");
      const p = result.find((r) => r.provider_type === config?.provider_type);
      if (p?.status === "Online") {
        notify.success("Connection successful");
      } else {
        notify.error("Connection failed", `Status: ${p?.status ?? "unknown"}`);
      }
    } catch (err) {
      notify.error("Connection test failed", err as string);
    } finally {
      setTesting(false);
    }
  };

  if (loading && providers.length === 0) {
    return (
      <Stack spacing={0}>
        <SectionHeader title="Loading..." />
      </Stack>
    );
  }

  if (error && providers.length === 0) {
    return (
      <Stack spacing={0}>
        <SectionHeader title="Error" description={error} />
      </Stack>
    );
  }

  if (!config) {
    return (
      <Stack spacing={0}>
        <SectionHeader title="No providers configured" />
        <Typography sx={{ px: 2.5, fontSize: 13, color: "text.secondary" }}>
          The provider_configs database table is empty. This may happen if the initial database setup didn't run correctly.
        </Typography>
        <Stack direction="row" spacing={1.5} sx={{ px: 2.5, py: 2 }}>
          <Button
            size="small"
            variant="outlined"
            onClick={() => actions.refresh()}
            disabled={loading}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {loading ? "Refreshing..." : "Retry"}
          </Button>
        </Stack>
      </Stack>
    );
  }

  return (
    <Stack spacing={0}>
      <SectionHeader title="LLM Provider" />

      <SettingCard
        title={config.provider_type}
        description="Local Ollama instance"
        action={
          <Badge
            label={status ?? "Unknown"}
            color={statusColor[status ?? "Unavailable"]}
          />
        }
      />

      <SettingCard
        title="Enabled"
        description="Enable or disable this provider"
        action={
          <Switch
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              setDirty(true);
            }}
          />
        }
      />

      <SettingCard title="Host URL" description="Ollama server address">
        <TextField
          value={host}
          onChange={(e) => {
            setHost(e.target.value);
            setDirty(true);
          }}
          placeholder="http://127.0.0.1:11434"
          fullWidth
          size="small"
          sx={appTextFieldSx}
        />
      </SettingCard>

      <Stack direction="row" spacing={1.5} sx={{ px: 2.5, py: 2 }}>
        <Button
          size="small"
          variant="contained"
          disableElevation
          onClick={handleSave}
          disabled={saving || !dirty}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          {saving ? "Saving..." : "Save"}
        </Button>
        <Button
          size="small"
          variant="outlined"
          onClick={handleTest}
          disabled={testing}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          {testing ? "Testing..." : "Test Connection"}
        </Button>
      </Stack>
    </Stack>
  );
}
