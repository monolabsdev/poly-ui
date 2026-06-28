import { useCallback, useEffect, useState } from "react";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Chip from "@mui/material/Chip";
import Collapse from "@mui/material/Collapse";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import LinearProgress from "@mui/material/LinearProgress";
import Paper from "@mui/material/Paper";
import Skeleton from "@mui/material/Skeleton";
import Stack from "@mui/material/Stack";
import Switch from "@mui/material/Switch";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import {
  ChevronDown,
  Cpu,
  Download,
  Eye,
  EyeOff,
  Globe,
  Plus,
  RefreshCw,
  Route,
  Search,
  Settings,
  Sparkles,
  Trash2,
  X,
  XCircle,
  Zap,
} from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { useShallow } from "zustand/react/shallow";
import { SectionHeader, SettingSurface } from "../SettingComponents";
import { appPanelSx, appTextFieldSx } from "@/components/ui/appDialog";
import { useNotify } from "@/hooks/useNotify";
import { formatFileSize, loggedInvoke } from "@/lib/utils/utils";
import { useOllama, type PullProgress } from "@/features/ollama";
import { getCurrentProviderAccountId, useProviderStore, type ProviderStatus, type ProviderStatusResponse } from "@/features/providers";
import { PROVIDER_PRESETS, lookupPreset, type ProviderPreset } from "@/features/providers/presets";
import { WebSearchSettings } from "@/features/web-search/WebSearchSettings";

const statusChipColor: Record<
  ProviderStatus,
  "success" | "error" | "warning" | "default"
> = {
  Online: "success",
  Offline: "error",
  Reconnecting: "warning",
  Unavailable: "default",
};

const presetIcons: Record<string, React.ReactNode> = {
  openai: <Sparkles size={22} />,
  openrouter: <Route size={22} />,
  groq: <Zap size={22} />,
  together: <Globe size={22} />,
  deepseek: <Search size={22} />,
  ollama: <Cpu size={22} />,
  custom: <Settings size={22} />,
};

const isOllamaLocal = (p: ProviderStatusResponse) =>
  p.provider_type === "OllamaLocal";

function ProviderCard({
  provider,
  updateProviderConfig,
  onDelete,
}: {
  provider: ProviderStatusResponse;
  updateProviderConfig: (config: {
    id: number;
    provider_type: "OllamaLocal" | "OpenAICompatible";
    enabled?: boolean;
    ollama_host?: string;
    api_key?: string;
    api_base_url?: string;
  }) => Promise<void>;
  onDelete?: () => void;
}) {
  const notify = useNotify();
  const ollama = useOllama();
  const isOllama = isOllamaLocal(provider);

  const preset = lookupPreset(
    isOllama ? "ollama" : (provider.config.preset ?? null),
    isOllama
      ? (provider.config.ollama_host ?? "")
      : (provider.config.api_base_url ?? null),
  );
  const url = isOllama
    ? (provider.config.ollama_host ?? "http://127.0.0.1:11434")
    : (provider.config.api_base_url ?? "");

  const [editing, setEditing] = useState(false);
  const [host, setHost] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showKey, setShowKey] = useState(false);

  const openEdit = () => {
    setHost(isOllama
      ? (provider.config.ollama_host ?? "http://127.0.0.1:11434")
      : (provider.config.api_base_url ?? ""));
    setApiKey(provider.config.api_key ?? "");
    setEnabled(provider.config.enabled);
    setDirty(false);
    setEditing(true);
  };

  const closeEdit = () => {
    setEditing(false);
    setDirty(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      if (isOllama) {
        await updateProviderConfig({
          id: provider.config.id,
          provider_type: "OllamaLocal",
          ollama_host: host.trim(),
          enabled,
        });
      } else {
        await updateProviderConfig({
          id: provider.config.id,
          provider_type: "OpenAICompatible",
          api_base_url: host.trim(),
          api_key: apiKey.trim() || undefined,
          enabled,
        });
        ollama.actions.clearExternalModels();
        await ollama.refresh();
      }
      setDirty(false);
      setEditing(false);
      notify.success("Connection saved");
    } catch (err) {
      notify.error("Failed to save", String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ py: 0.75 }}>
      <SettingSurface>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1}
          sx={{ mb: 0.5 }}
        >
          <Typography variant="body1" sx={{ fontWeight: 700 }}>
            {preset.label}
          </Typography>
          <Chip
            label={provider.status}
            color={statusChipColor[provider.status]}
            size="small"
          />
          <Box sx={{ flexGrow: 1 }} />
          {editing ? (
            <IconButton size="small" aria-label="Close edit" onClick={closeEdit}>
              <X size={15} />
            </IconButton>
          ) : (
            <IconButton
              size="small"
              aria-label={`Edit ${preset.label}`}
              onClick={openEdit}
            >
              <Settings size={15} />
            </IconButton>
          )}
          {!isOllama && onDelete && (
            <IconButton
              size="small"
              aria-label={`Delete ${preset.label}`}
              onClick={onDelete}
            >
              <Trash2 size={15} />
            </IconButton>
          )}
        </Stack>

        {!editing && (
          <Typography variant="caption" color="text.secondary">
            {url}
          </Typography>
        )}

        <Collapse in={editing}>
          <Stack spacing={1} sx={{ mt: 1 }}>
            {isOllama ? (
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
            ) : (
              <TextField
                label="API base URL"
                value={host}
                onChange={(e) => {
                  setHost(e.target.value);
                  setDirty(true);
                }}
                placeholder="https://api.openai.com/v1"
                fullWidth
                size="small"
                sx={appTextFieldSx}
              />
            )}
            {!isOllama && (
              <TextField
                label="API key (optional)"
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setDirty(true);
                }}
                placeholder={preset.requiresApiKey ? "sk-..." : "Optional"}
                type={showKey ? "text" : "password"}
                autoComplete="off"
                fullWidth
                size="small"
                sx={appTextFieldSx}
                slotProps={{
                  input: {
                    endAdornment: (
                      <IconButton
                        size="small"
                        aria-label={showKey ? "Hide API key" : "Show API key"}
                        onClick={() => setShowKey(!showKey)}
                      >
                        {showKey ? <EyeOff size={15} /> : <Eye size={15} />}
                      </IconButton>
                    ),
                  },
                }}
              />
            )}
            <Stack direction="row" alignItems="center" spacing={1}>
              <Typography variant="body2" color="text.secondary">
                Enabled
              </Typography>
              <Switch
                checked={enabled}
                onChange={(e) => {
                  setEnabled(e.target.checked);
                  setDirty(true);
                }}
              />
              <Box sx={{ flexGrow: 1 }} />
              <Button
                size="small"
                variant="outlined"
                disabled={!dirty || saving || !host.trim()}
                onClick={save}
                sx={{ textTransform: "none", fontWeight: 700 }}
              >
                {saving ? "Saving..." : "Save"}
              </Button>
            </Stack>
          </Stack>
        </Collapse>
      </SettingSurface>
    </Box>
  );
}

export function ConnectionsTab() {
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

  const [addOpen, setAddOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<ProviderPreset | null>(null);
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
    const unlisten = listen<PullProgress>("pull-progress", (event) => {
      ollama.actions.setPullProgress(event.payload);
    });
    return () => void unlisten.then((stop) => stop());
  }, [ollama.actions]);

  const selectPreset = (preset: ProviderPreset) => {
    setSelectedPreset(preset);
    setAddApiBaseUrl(preset.baseUrl);
    setAddApiKey("");
  };

  const saveAdd = async () => {
    if (!selectedPreset) return;
    const isOllamaPreset = selectedPreset.kind === "ollama-local";
    const url = isOllamaPreset
      ? addApiBaseUrl.trim() || "http://127.0.0.1:11434"
      : addApiBaseUrl.trim();
    if (!url) return;
    setAddingProvider(true);
    try {
      if (isOllamaPreset) {
        await actions.addProvider({
          provider_type: "OllamaLocal",
          enabled: true,
          ollama_host: url,
          preset: selectedPreset.id,
          headers: selectedPreset.defaultHeaders
            ? JSON.stringify(selectedPreset.defaultHeaders)
            : undefined,
          model_suggestions: selectedPreset.modelSuggestions
            ? JSON.stringify(selectedPreset.modelSuggestions)
            : undefined,
        });
      } else {
        await actions.addProvider({
          provider_type: "OpenAICompatible",
          enabled: true,
          api_base_url: url,
          api_key: addApiKey.trim() || undefined,
          preset: selectedPreset.id,
          headers: selectedPreset.defaultHeaders
            ? JSON.stringify(selectedPreset.defaultHeaders)
            : undefined,
          model_suggestions: selectedPreset.modelSuggestions
            ? JSON.stringify(selectedPreset.modelSuggestions)
            : undefined,
        });
        ollama.actions.clearExternalModels();
        await ollama.refresh();
      }
      setAddOpen(false);
      setSelectedPreset(null);
      setAddApiBaseUrl("");
      setAddApiKey("");
      notify.success("Connection added");
    } catch (err) {
      notify.error("Failed to add connection", String(err));
    } finally {
      setAddingProvider(false);
    }
  };

  const handleCloseAdd = () => {
    setAddOpen(false);
    setSelectedPreset(null);
    setAddApiBaseUrl("");
    setAddApiKey("");
  };

  const handleDelete = useCallback(
    async (provider: ProviderStatusResponse) => {
      const id = provider.config.id;
      if (!confirm(`Delete "${lookupPreset(provider.config.preset, provider.config.api_base_url ?? null).label}" connection?`)) return;
      try {
        await actions.deleteProvider(id);
        notify.success("Connection deleted");
      } catch (err) {
        notify.error("Failed to delete", String(err));
      }
    },
    [actions, notify],
  );

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
      await loggedInvoke("pull_model", {
        model,
        accountId: getCurrentProviderAccountId(),
      });
      setNewModelName("");
      await refreshModels();
    } catch (err) {
      if (err !== "Pull cancelled by user")
        notify.error("Failed to pull model", String(err));
    } finally {
      setIsPulling(false);
      ollama.actions.setPullingModel(null);
      ollama.actions.setPullProgress(null);
    }
  };

  const deleteModel = async (model: string) => {
    if (
      !confirm(
        `Delete installed model "${model}"? You will need to download it again to use it.`,
      )
    )
      return;
    try {
      await ollama.deleteModel(model);
      await refreshModels();
    } catch (err) {
      notify.error("Failed to delete model", String(err));
    }
  };

  return (
    <Stack spacing={0}>
      <SectionHeader
        title="LLM Providers"
        description="Connect local or cloud model providers."
        action={
          <Button
            size="small"
            variant="contained"
            startIcon={<Plus size={15} />}
            onClick={() => setAddOpen(true)}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Add LLM
          </Button>
        }
      />

      {loading && providers.length === 0 && (
        <Box sx={{ py: 0.75 }}>
          <SettingSurface>
            <Stack
              direction="row"
              alignItems="center"
              spacing={1}
              sx={{ mb: 0.5 }}
            >
              <Skeleton variant="text" width={60} height={24} />
              <Skeleton variant="rounded" width={70} height={24} sx={{ borderRadius: "9999px" }} />
              <Box sx={{ flexGrow: 1 }} />
              <Skeleton variant="circular" width={28} height={28} />
            </Stack>
            <Skeleton variant="text" width={180} height={18} />
          </SettingSurface>
        </Box>
      )}
      {error && providers.length === 0 && (
        <Typography sx={{ fontSize: 13, color: "text.secondary", py: 1 }}>
          Connection error: {String(error)}
        </Typography>
      )}

      {providers.map((provider) => {
        const key = provider.config.id;
        return (
          <ProviderCard
            key={key}
            provider={provider}
            updateProviderConfig={actions.updateProviderConfig}
            onDelete={
              isOllamaLocal(provider) ? undefined : () => handleDelete(provider)
            }
          />
        );
      })}

      <Divider sx={{ my: 2 }} />

      <SectionHeader
        title="Web Search API Keys"
        description="API keys for live web search during chat."
      />
      <WebSearchSettings />

      <Divider sx={{ my: 2 }} />

      <SectionHeader
        title="Ollama models"
        description="Install and remove models from local Ollama."
      />
      <Button
        onClick={() => setInstallerOpen((open) => !open)}
        endIcon={
          <ChevronDown
            size={16}
            style={{
              transform: installerOpen ? "rotate(180deg)" : undefined,
              transition: "transform 150ms ease",
            }}
          />
        }
        sx={{
          justifyContent: "space-between",
          textTransform: "none",
          color: "text.primary",
          fontWeight: 700,
          px: 0,
          py: 1,
        }}
      >
        Model installer
      </Button>
      <Collapse in={installerOpen}>
        <Stack spacing={1.5} sx={{ pb: 2 }}>
          <Box sx={{ display: "flex", gap: 1 }}>
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
            <Box sx={[appPanelSx, { py: 1 }]}>
              <Stack direction="row" justifyContent="space-between">
                <Typography sx={{ fontSize: 12 }}>
                  Pulling {ollama.pullingModel}: {ollama.pullProgress.status}
                </Typography>
                <IconButton
                  size="small"
                  aria-label="Cancel model download"
                  onClick={() => void ollama.cancelPull()}
                >
                  <XCircle size={15} />
                </IconButton>
              </Stack>
              <LinearProgress />
            </Box>
          )}
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Typography sx={{ fontSize: 13, fontWeight: 700 }}>
              Installed models
            </Typography>
            <IconButton
              size="small"
              aria-label="Refresh installed models"
              onClick={refreshModels}
              disabled={isRefreshing}
            >
              <RefreshCw size={15} />
            </IconButton>
          </Stack>
          {ollama.localModels.length === 0 && (
            <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
              No local models found.
            </Typography>
          )}
          {ollama.localModels.map((model) => (
            <Stack
              key={model.name}
              direction="row"
              justifyContent="space-between"
              alignItems="center"
            >
              <Box>
                <Typography sx={{ fontSize: 13, fontWeight: 600 }}>
                  {model.name}
                </Typography>
                <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                  {formatFileSize(model.size)}
                </Typography>
              </Box>
              <IconButton
                size="small"
                aria-label={`Delete ${model.name}`}
                onClick={() => void deleteModel(model.name)}
              >
                <Trash2 size={15} />
              </IconButton>
            </Stack>
          ))}
        </Stack>
      </Collapse>

      <Dialog open={addOpen} onClose={handleCloseAdd} maxWidth="sm" fullWidth>
        <DialogTitle
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontSize: 18,
            fontWeight: 700,
          }}
        >
          Add LLM Connection
          <IconButton size="small" aria-label="Close" onClick={handleCloseAdd}>
            <X size={18} />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, fontSize: 13, color: "text.secondary" }}>
            Pick a provider preset or configure a custom connection.
          </Typography>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 1,
              mb: 2,
            }}
          >
            {PROVIDER_PRESETS.map((preset) => {
              const selected = selectedPreset?.id === preset.id;
              return (
                <Paper
                  key={preset.id}
                  variant="outlined"
                  onClick={() => selectPreset(preset)}
                  sx={{
                    p: 1.5,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    borderColor: selected ? "primary.main" : undefined,
                    borderWidth: selected ? 2 : 1,
                    bgcolor: selected ? "action.selected" : "transparent",
                    transition: "all 120ms ease",
                    "&:hover": {
                      borderColor: "primary.light",
                      bgcolor: "action.hover",
                    },
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: selected ? "primary.main" : "text.secondary",
                      flexShrink: 0,
                    }}
                  >
                    {presetIcons[preset.id] ?? <Settings size={22} />}
                  </Box>
                  <Typography
                    variant="body2"
                    sx={{
                      fontWeight: selected ? 700 : 500,
                      color: selected ? "primary.main" : "text.primary",
                    }}
                  >
                    {preset.label}
                  </Typography>
                </Paper>
              );
            })}
          </Box>

          {selectedPreset && (
            <Stack spacing={2}>
              <Divider />
              <Typography sx={{ fontSize: 14, fontWeight: 700 }}>
                {selectedPreset.label}
              </Typography>

              {selectedPreset.kind === "ollama-local" ? (
                <TextField
                  label="Host"
                  value={addApiBaseUrl}
                  onChange={(e) => setAddApiBaseUrl(e.target.value)}
                  placeholder="http://127.0.0.1:11434"
                  fullWidth
                  size="small"
                />
              ) : (
                <>
                  <TextField
                    label="API base URL"
                    value={addApiBaseUrl}
                    onChange={(e) => setAddApiBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    required
                    fullWidth
                    size="small"
                  />
                  {selectedPreset.requiresApiKey && (
                    <TextField
                      label="API key"
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
                            <IconButton
                              size="small"
                              aria-label={showAddKey ? "Hide API key" : "Show API key"}
                              onClick={() => setShowAddKey(!showAddKey)}
                            >
                              {showAddKey ? <EyeOff size={15} /> : <Eye size={15} />}
                            </IconButton>
                          ),
                        },
                      }}
                    />
                  )}
                  {selectedPreset.modelSuggestions &&
                    selectedPreset.modelSuggestions.length > 0 && (
                      <Typography sx={{ fontSize: 12, color: "text.secondary" }}>
                        Suggested models: {selectedPreset.modelSuggestions.join(", ")}
                      </Typography>
                    )}
                </>
              )}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={handleCloseAdd} sx={{ textTransform: "none" }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            disabled={!selectedPreset || !addApiBaseUrl.trim() || addingProvider}
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
