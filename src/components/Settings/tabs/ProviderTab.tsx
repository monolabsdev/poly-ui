import { useState, useEffect } from "react";
import {
  Box,
  Button,
  IconButton,
  LinearProgress,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { Download, RefreshCw, Trash2, XCircle } from "lucide-react";
import { useShallow } from "zustand/react/shallow";
import { SettingCard, SectionHeader, Badge } from "../SettingComponents";
import { appPanelSx, appTextFieldSx } from "@/components/ui/appDialog";
import { useProviderStore, type ProviderStatus } from "@/services/providers";
import { useOllama, type PullProgress } from "@/services/ollama";
import { useNotify } from "@/hooks/useNotify";
import { loggedInvoke, formatFileSize } from "@/lib/utils";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const statusColor: Record<ProviderStatus, string> = {
  Online: "#22c55e",
  Offline: "#ef4444",
  Reconnecting: "#f59e0b",
  Unavailable: "#6b7280",
};

export function ProviderTab() {
  const notify = useNotify();
  const { providers, loading, error, actions } = useProviderStore(
    useShallow((state) => ({
      providers: state.providers,
      loading: state.loading,
      error: state.error,
      actions: state.actions,
    })),
  );
  const ollama = useOllama();

  const provider = providers[0];
  const config = provider?.config;
  const status = provider?.status;

  const [host, setHost] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  useEffect(() => {
    const unlistenPromise = listen<PullProgress>("pull-progress", (event) => {
      ollama.actions.setPullProgress(event.payload);
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [ollama.actions]);

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

  const refreshModels = async () => {
    setIsRefreshing(true);
    try {
      await ollama.refresh();
    } catch {
      // ignore
    } finally {
      setIsRefreshing(false);
    }
  };

  const handlePullModel = async () => {
    if (!newModelName.trim()) return;
    const modelToPull = newModelName.trim();
    ollama.actions.setPullingModel(modelToPull);
    setIsPulling(true);
    ollama.actions.setPullProgress({ status: "Starting..." });

    try {
      await loggedInvoke("pull_model", { model: modelToPull });
      setNewModelName("");
      await new Promise((r) => setTimeout(r, 1000));
      await refreshModels();
      await new Promise((r) => setTimeout(r, 500));
      await refreshModels();
    } catch (error) {
      if (error !== "Pull cancelled by user") {
        console.error("Failed to pull model:", error);
      }
    } finally {
      ollama.actions.setPullingModel(null);
      ollama.actions.setPullProgress(null);
      setIsPulling(false);
    }
  };

  const handleCancelPull = async () => {
    try {
      await ollama.cancelPull();
    } catch (error) {
      console.error("Failed to cancel pull:", error);
    }
  };

  const handleDeleteModel = async (modelName: string) => {
    if (!confirm(`Are you sure you want to delete ${modelName}?`)) return;
    try {
      await ollama.deleteModel(modelName);
      refreshModels();
    } catch (error) {
      notify.error("Failed to delete model", error as string);
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
        <Stack direction="row" spacing={1.5} sx={{ py: 1.5 }}>
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

      <SettingCard title="Actions">
        <Stack direction="row" spacing={1.5}>
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
      </SettingCard>

      <SectionHeader
        title="Model Management"
        description="Download and manage local models."
      />

      <SettingCard title="Pull Model">
        <Box sx={{ display: "flex", gap: 1 }}>
          <TextField
            fullWidth
            size="small"
            placeholder="e.g. llama3, deepseek-r1:7b"
            value={newModelName}
            onChange={(e) => setNewModelName(e.target.value)}
            disabled={isPulling}
            sx={{
              ...appTextFieldSx,
              "& .MuiOutlinedInput-root": {
                bgcolor: "action.hover",
              },
            }}
          />
          <Button
            variant="contained"
            disableElevation
            onClick={handlePullModel}
            disabled={isPulling || !newModelName.trim()}
            startIcon={<Download size={16} />}
            sx={{
              borderRadius: "8px",
              textTransform: "none",
              px: 3,
              bgcolor: "primary.main",
              fontWeight: 600,
              "&:hover": { bgcolor: "primary.dark" },
            }}
          >
            Pull
          </Button>
        </Box>
      </SettingCard>

      {isPulling && ollama.pullProgress ? (
        <Box sx={{ ...appPanelSx, mb: 1 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              mb: 1,
              alignItems: "center",
            }}
          >
            <Typography sx={{ fontWeight: 600, fontSize: 13, color: "text.primary" }}>
              Pulling {ollama.pullingModel}...
            </Typography>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Typography sx={{ color: "text.secondary", fontSize: 12 }}>
                {ollama.pullProgress.status}
              </Typography>
              <IconButton
                size="small"
                onClick={handleCancelPull}
                title="Cancel Pull"
                sx={{ color: "error.main", p: 0.5, borderRadius: "8px" }}
              >
                <XCircle size={14} />
              </IconButton>
            </Box>
          </Box>
          {ollama.pullProgress.total && ollama.pullProgress.completed ? (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <LinearProgress
                variant="determinate"
                value={(ollama.pullProgress.completed / ollama.pullProgress.total) * 100}
                sx={{
                  flex: 1,
                  height: 6,
                  borderRadius: 3,
                  bgcolor: "action.selected",
                  "& .MuiLinearProgress-bar": { borderRadius: 3 },
                }}
              />
              <Typography
                sx={{
                  minWidth: 35,
                  fontSize: 12,
                  fontWeight: 600,
                  color: "text.primary",
                }}
              >
                {Math.round(
                  (ollama.pullProgress.completed / ollama.pullProgress.total) * 100,
                )}
                %
              </Typography>
            </Box>
          ) : (
            <LinearProgress sx={{ height: 4, borderRadius: 2 }} />
          )}
        </Box>
      ) : null}

      <SettingCard title="Local Models">
        <Stack spacing={1}>
          <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <Typography sx={{ fontSize: 13, fontWeight: 600, color: "text.primary" }}>
              Installed
            </Typography>
            <IconButton
              size="small"
              onClick={refreshModels}
              disabled={isRefreshing}
              sx={{ borderRadius: "8px" }}
            >
              <RefreshCw size={16} style={isRefreshing ? { animation: "spin 1s linear infinite" } : undefined} />
            </IconButton>
          </Box>

          {ollama.models.length === 0 ? (
            <Typography sx={{ fontSize: 12, color: "text.secondary", py: 2, textAlign: "center" }}>
              No local models found.
            </Typography>
          ) : (
            ollama.models.map((model) => (
              <Box
                key={model.name}
                sx={{
                  ...appPanelSx,
                  p: 1.5,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <Box>
                  <Typography sx={{ fontSize: 13, fontWeight: 600, color: "text.primary" }}>
                    {model.name}
                  </Typography>
                  <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.25 }}>
                    {formatFileSize(model.size)}
                  </Typography>
                </Box>
                <IconButton
                  size="small"
                  onClick={() => handleDeleteModel(model.name)}
                  sx={{
                    color: "text.secondary",
                    borderRadius: "8px",
                    "&:hover": { color: "error.main" },
                  }}
                >
                  <Trash2 size={16} />
                </IconButton>
              </Box>
            ))
          )}
        </Stack>
      </SettingCard>
    </Stack>
  );
}
