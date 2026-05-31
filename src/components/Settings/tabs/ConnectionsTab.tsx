import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  LinearProgress,
  Stack,
  Switch,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import { ChevronDown, Download, Edit3, Eye, EyeOff, Plus, RefreshCw, Trash2, X, XCircle } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { useShallow } from "zustand/react/shallow";
import { SectionHeader } from "../SettingComponents";
import { appPanelSx, appTextFieldSx } from "@/components/ui/appDialog";
import { useNotify } from "@/hooks/useNotify";
import { formatFileSize, loggedInvoke } from "@/lib/utils";
import { useOllama, type PullProgress } from "@/services/ollama";
import { useProviderStore, type ProviderStatus } from "@/services/providers";

const statusChipColor: Record<ProviderStatus, "success" | "error" | "warning" | "default"> = {
  Online: "success",
  Offline: "error",
  Reconnecting: "warning",
  Unavailable: "default",
};

export function ConnectionsTab() {
  const theme = useTheme();
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
  const local = providers.find((item) => item.provider_type === "OllamaLocal");
  const external = providers.find((item) => item.provider_type === "OpenAICompatible");

  const [ollamaEditing, setOllamaEditing] = useState(false);
  const [ollamaHost, setOllamaHost] = useState("");
  const [ollamaEnabled, setOllamaEnabled] = useState(true);
  const [ollamaDirty, setOllamaDirty] = useState(false);
  const [savingOllama, setSavingOllama] = useState(false);

  const [externalEditing, setExternalEditing] = useState(false);
  const [externalHost, setExternalHost] = useState("");
  const [externalApiKey, setExternalApiKey] = useState("");
  const [externalEnabled, setExternalEnabled] = useState(true);
  const [externalDirty, setExternalDirty] = useState(false);
  const [savingExternal, setSavingExternal] = useState(false);
  const [showExternalKey, setShowExternalKey] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [addApiBaseUrl, setAddApiBaseUrl] = useState("");
  const [addApiKey, setAddApiKey] = useState("");
  const [showAddKey, setShowAddKey] = useState(false);
  const [addingProvider, setAddingProvider] = useState(false);

  const [installerOpen, setInstallerOpen] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => void actions.refresh(), [actions]);
  useEffect(() => {
    if (!local) return;
    setOllamaHost(local.config.ollama_host ?? "http://127.0.0.1:11434");
    setOllamaEnabled(local.config.enabled);
    setOllamaDirty(false);
  }, [local]);
  useEffect(() => {
    if (!external) return;
    setExternalHost(external.config.api_base_url ?? "");
    setExternalApiKey(external.config.api_key ?? "");
    setExternalEnabled(external.config.enabled);
    setExternalDirty(false);
  }, [external]);
  useEffect(() => {
    const unlisten = listen<PullProgress>("pull-progress", (event) => {
      ollama.actions.setPullProgress(event.payload);
    });
    return () => void unlisten.then((stop) => stop());
  }, [ollama.actions]);

  const saveOllama = async () => {
    setSavingOllama(true);
    try {
      await actions.updateProviderConfig({ provider_type: "OllamaLocal", ollama_host: ollamaHost.trim(), enabled: ollamaEnabled });
      setOllamaDirty(false);
      notify.success("Ollama settings saved");
    } catch (err) {
      notify.error("Failed to save", String(err));
    } finally {
      setSavingOllama(false);
    }
  };

  const saveExternal = async () => {
    if (!externalHost.trim()) return;
    setSavingExternal(true);
    try {
      await actions.updateProviderConfig({
        provider_type: "OpenAICompatible",
        api_base_url: externalHost.trim(),
        api_key: externalApiKey.trim(),
        enabled: externalEnabled,
      });
      ollama.actions.clearExternalModels();
      await ollama.refresh();
      setExternalEditing(false);
      setExternalDirty(false);
      notify.success("Connection saved");
    } catch (err) {
      notify.error("Failed to save", String(err));
    } finally {
      setSavingExternal(false);
    }
  };

  const saveAdd = async () => {
    if (!addApiBaseUrl.trim()) return;
    setAddingProvider(true);
    try {
      await actions.updateProviderConfig({
        provider_type: "OpenAICompatible",
        api_base_url: addApiBaseUrl.trim(),
        api_key: addApiKey.trim(),
        enabled: true,
      });
      ollama.actions.clearExternalModels();
      await ollama.refresh();
      setAddOpen(false);
      setAddApiBaseUrl("");
      setAddApiKey("");
      notify.success("Connection added");
    } catch (err) {
      notify.error("Failed to add connection", String(err));
    } finally {
      setAddingProvider(false);
    }
  };

  const refreshModels = async () => {
    setIsRefreshing(true);
    try {
      await ollama.refresh();
    } finally {
      setIsRefreshing(false);
    }
  };

  const pullModel = async () => {
    const model = newModelName.trim();
    if (!model) return;
    setIsPulling(true);
    ollama.actions.setPullingModel(model);
    ollama.actions.setPullProgress({ status: "Starting..." });
    try {
      await loggedInvoke("pull_model", { model });
      setNewModelName("");
      await refreshModels();
    } catch (err) {
      if (err !== "Pull cancelled by user") notify.error("Failed to pull model", String(err));
    } finally {
      setIsPulling(false);
      ollama.actions.setPullingModel(null);
      ollama.actions.setPullProgress(null);
    }
  };

  const deleteModel = async (model: string) => {
    if (!confirm(`Delete ${model}?`)) return;
    try {
      await ollama.deleteModel(model);
      await refreshModels();
    } catch (err) {
      notify.error("Failed to delete model", String(err));
    }
  };

  const cardBorder = `1px solid ${theme.palette.divider}`;

  return (
    <Stack spacing={0}>
      <SectionHeader
        title="Connections"
        description="Connect local or OpenAI-compatible model servers."
        action={
          <Button
            size="small"
            variant="contained"
            startIcon={<Plus size={15} />}
            onClick={() => setAddOpen(true)}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Add connection
          </Button>
        }
      />

      {loading && providers.length === 0 && (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: theme.spacing(1) }}>
          Loading connections...
        </Typography>
      )}
      {error && providers.length === 0 && (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: theme.spacing(1) }}>
          Connection error: {error}
        </Typography>
      )}

      {providers.map((provider) => {
        const isOllama = provider.provider_type === "OllamaLocal";
        const isEditing = isOllama ? ollamaEditing : externalEditing;
        const url = isOllama
          ? (provider.config.ollama_host ?? "http://127.0.0.1:11434")
          : (provider.config.api_base_url ?? "");
        const label = isOllama ? "Ollama" : "OpenAI-compatible";

        return (
          <Box key={provider.provider_type} sx={{ py: theme.spacing(0.75) }}>
            <Box sx={{ p: theme.spacing(1.5), borderRadius: 1, border: cardBorder }}>
              <Stack direction="row" alignItems="center" spacing={theme.spacing(1)} sx={{ mb: theme.spacing(0.5) }}>
                <Typography variant="body1" sx={{ fontWeight: 700 }}>
                  {label}
                </Typography>
                <Chip label={provider.status} color={statusChipColor[provider.status]} size="small" />
                <Box sx={{ flexGrow: 1 }} />
                <IconButton
                  size="small"
                  onClick={() => {
                    if (isOllama) {
                      setOllamaEditing(!ollamaEditing);
                    } else {
                      setExternalEditing(!externalEditing);
                    }
                  }}
                >
                  <Edit3 size={15} />
                </IconButton>
              </Stack>

              {!isEditing && (
                <Typography variant="caption" color="text.secondary">
                  {url}
                </Typography>
              )}

              <Collapse in={isEditing}>
                <Stack spacing={theme.spacing(1)} sx={{ mt: theme.spacing(1) }}>
                  {isOllama ? (
                    <>
                      <TextField
                        value={ollamaHost}
                        onChange={(e) => { setOllamaHost(e.target.value); setOllamaDirty(true); }}
                        placeholder="http://127.0.0.1:11434"
                        fullWidth
                        size="small"
                        sx={appTextFieldSx}
                      />
                      <Stack direction="row" alignItems="center" spacing={theme.spacing(1)}>
                        <Typography variant="body2" color="text.secondary">Enabled</Typography>
                        <Switch
                          checked={ollamaEnabled}
                          onChange={(e) => { setOllamaEnabled(e.target.checked); setOllamaDirty(true); }}
                        />
                        <Box sx={{ flexGrow: 1 }} />
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={!ollamaDirty || savingOllama || !ollamaHost.trim()}
                          onClick={saveOllama}
                          sx={{ textTransform: "none", fontWeight: 700 }}
                        >
                          {savingOllama ? "Saving..." : "Save"}
                        </Button>
                      </Stack>
                    </>
                  ) : (
                    <>
                      <TextField
                        label="API base URL"
                        value={externalHost}
                        onChange={(e) => { setExternalHost(e.target.value); setExternalDirty(true); }}
                        placeholder="https://api.openai.com/v1"
                        fullWidth
                        size="small"
                        sx={appTextFieldSx}
                      />
                      <TextField
                        label="API key (optional)"
                        value={externalApiKey}
                        onChange={(e) => { setExternalApiKey(e.target.value); setExternalDirty(true); }}
                        placeholder="sk-..."
                        type={showExternalKey ? "text" : "password"}
                        autoComplete="off"
                        fullWidth
                        size="small"
                        sx={appTextFieldSx}
                        slotProps={{
                          input: {
                            endAdornment: (
                              <IconButton size="small" onClick={() => setShowExternalKey(!showExternalKey)} tabIndex={-1}>
                                {showExternalKey ? <EyeOff size={15} /> : <Eye size={15} />}
                              </IconButton>
                            ),
                          },
                        }}
                      />
                      <Stack direction="row" alignItems="center" spacing={theme.spacing(1)}>
                        <Typography variant="body2" color="text.secondary">Enabled</Typography>
                        <Switch
                          checked={externalEnabled}
                          onChange={(e) => { setExternalEnabled(e.target.checked); setExternalDirty(true); }}
                        />
                        <Box sx={{ flexGrow: 1 }} />
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={!externalDirty || savingExternal || !externalHost.trim()}
                          onClick={saveExternal}
                          sx={{ textTransform: "none", fontWeight: 700 }}
                        >
                          {savingExternal ? "Saving..." : "Save"}
                        </Button>
                      </Stack>
                    </>
                  )}
                </Stack>
              </Collapse>
            </Box>
          </Box>
        );
      })}

      <Divider sx={{ my: theme.spacing(2) }} />

      <SectionHeader title="Ollama models" description="Install and remove models from local Ollama." />
      <Button
        onClick={() => setInstallerOpen((open) => !open)}
        endIcon={<ChevronDown size={16} style={{ transform: installerOpen ? "rotate(180deg)" : undefined, transition: "transform 150ms ease" }} />}
        sx={{ justifyContent: "space-between", textTransform: "none", color: "text.primary", fontWeight: 700, px: 0, py: 1 }}
      >
        Model installer
      </Button>
      <Collapse in={installerOpen}>
        <Stack spacing={theme.spacing(1.5)} sx={{ pb: theme.spacing(2) }}>
          <Box sx={{ display: "flex", gap: theme.spacing(1) }}>
            <TextField
              value={newModelName}
              onChange={(e) => setNewModelName(e.target.value)}
              placeholder="e.g. llama3, deepseek-r1:7b"
              fullWidth
              size="small"
              disabled={isPulling}
              sx={appTextFieldSx}
            />
            <Button
              variant="contained"
              disableElevation
              onClick={pullModel}
              disabled={isPulling || !newModelName.trim()}
              startIcon={<Download size={15} />}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              Pull
            </Button>
          </Box>
          {isPulling && ollama.pullProgress && (
            <Box sx={{ ...appPanelSx, py: theme.spacing(1) }}>
              <Stack direction="row" justifyContent="space-between">
                <Typography sx={{ fontSize: 12 }}>
                  Pulling {ollama.pullingModel}: {ollama.pullProgress.status}
                </Typography>
                <IconButton size="small" onClick={() => void ollama.cancelPull()}>
                  <XCircle size={15} />
                </IconButton>
              </Stack>
              <LinearProgress />
            </Box>
          )}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>Installed models</Typography>
            <IconButton size="small" onClick={refreshModels} disabled={isRefreshing}>
              <RefreshCw size={15} />
            </IconButton>
          </Stack>
          {ollama.localModels.length === 0 && (
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
              No local models found.
            </Typography>
          )}
          {ollama.localModels.map((model) => (
            <Stack key={model.name} direction="row" justifyContent="space-between" alignItems="center">
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>{model.name}</Typography>
                <Typography sx={{ fontSize: 12, color: "text.secondary" }}>{formatFileSize(model.size)}</Typography>
              </Box>
              <IconButton size="small" onClick={() => void deleteModel(model.name)}>
                <Trash2 size={15} />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      </Collapse>

      <Dialog open={addOpen} onClose={() => setAddOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 18, fontWeight: 700 }}>
          Add connection
          <IconButton size="small" onClick={() => setAddOpen(false)}><X size={18} /></IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, fontSize: 12, color: "text.secondary" }}>
            OpenAI API-compatible connection. API key optional for local servers.
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="API base URL"
              value={addApiBaseUrl}
              onChange={(e) => setAddApiBaseUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
              required
              fullWidth
              size="small"
            />
            <TextField
              label="API key (optional)"
              value={addApiKey}
              onChange={(e) => setAddApiKey(e.target.value)}
              placeholder="sk-..."
              type={showAddKey ? "text" : "password"}
              autoComplete="off"
              fullWidth
              size="small"
              slotProps={{
                input: {
                  endAdornment: (
                    <IconButton size="small" onClick={() => setShowAddKey(!showAddKey)} tabIndex={-1}>
                      {showAddKey ? <EyeOff size={15} /> : <Eye size={15} />}
                    </IconButton>
                  ),
                },
              }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setAddOpen(false)} sx={{ textTransform: "none" }}>Cancel</Button>
          <Button
            variant="contained"
            disableElevation
            disabled={!addApiBaseUrl.trim() || addingProvider}
            onClick={saveAdd}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {addingProvider ? "Saving..." : "Save"}
          </Button>
        </DialogActions>
      </Dialog>
    </Stack>
  );
}
