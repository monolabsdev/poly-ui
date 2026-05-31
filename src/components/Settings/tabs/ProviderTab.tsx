import { useEffect, useState } from "react";
import {
  Box,
  Button,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import { ChevronDown, Download, Plus, RefreshCw, Trash2, X, XCircle } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { useShallow } from "zustand/react/shallow";
import { Badge, SectionHeader, SettingCard } from "../SettingComponents";
import { appPanelSx, appTextFieldSx } from "@/components/ui/appDialog";
import { useNotify } from "@/hooks/useNotify";
import { formatFileSize, loggedInvoke } from "@/lib/utils";
import { useOllama, type PullProgress } from "@/services/ollama";
import { useProviderStore, type ProviderStatus } from "@/services/providers";

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
  const local = providers.find((item) => item.provider_type === "OllamaLocal");
  const external = providers.find((item) => item.provider_type === "OpenAICompatible");
  const [host, setHost] = useState("");
  const [localEnabled, setLocalEnabled] = useState(true);
  const [isLocalDirty, setIsLocalDirty] = useState(false);
  const [isSavingLocal, setIsSavingLocal] = useState(false);
  const [isExternalOpen, setIsExternalOpen] = useState(false);
  const [apiBaseUrl, setApiBaseUrl] = useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [externalEnabled, setExternalEnabled] = useState(true);
  const [isSavingExternal, setIsSavingExternal] = useState(false);
  const [isInstallerOpen, setIsInstallerOpen] = useState(false);
  const [newModelName, setNewModelName] = useState("");
  const [isPulling, setIsPulling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => void actions.refresh(), [actions]);
  useEffect(() => {
    if (!local) return;
    setHost(local.config.ollama_host ?? "http://127.0.0.1:11434");
    setLocalEnabled(local.config.enabled);
    setIsLocalDirty(false);
  }, [local]);
  useEffect(() => {
    if (!external) return;
    setApiBaseUrl(external.config.api_base_url ?? "https://api.openai.com/v1");
    setApiKey(external.config.api_key ?? "");
    setExternalEnabled(external.config.enabled);
  }, [external]);
  useEffect(() => {
    const unlisten = listen<PullProgress>("pull-progress", (event) => {
      ollama.actions.setPullProgress(event.payload);
    });
    return () => void unlisten.then((stop) => stop());
  }, [ollama.actions]);

  const saveLocal = async () => {
    setIsSavingLocal(true);
    try {
      await actions.updateProviderConfig({ provider_type: "OllamaLocal", ollama_host: host.trim(), enabled: localEnabled });
    setIsLocalDirty(false);
      notify.success("Ollama settings saved");
    } catch (err) {
      notify.error("Failed to save", String(err));
    } finally {
      setIsSavingLocal(false);
    }
  };

  const saveExternal = async () => {
    if (!apiBaseUrl.trim()) return;
    setIsSavingExternal(true);
    try {
      await actions.updateProviderConfig({
        provider_type: "OpenAICompatible",
        api_base_url: apiBaseUrl.trim(),
        api_key: apiKey.trim(),
        enabled: externalEnabled,
      });
      ollama.actions.clearExternalModels();
      await ollama.refresh();
      setIsExternalOpen(false);
      notify.success("Provider saved");
    } catch (err) {
      notify.error("Failed to save", String(err));
    } finally {
      setIsSavingExternal(false);
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

  if (loading && providers.length === 0) return <SectionHeader title="Loading providers..." />;
  if (error && providers.length === 0) return <SectionHeader title="Provider error" description={error} />;

  return (
    <Stack spacing={0}>
      <SectionHeader
        title="Providers"
        description="Connect local or OpenAI-compatible model servers."
        action={<Button size="small" variant="contained" startIcon={<Plus size={15} />} onClick={() => setIsExternalOpen(true)} sx={{ textTransform: "none", fontWeight: 700 }}>Add provider</Button>}
      />

      <SettingCard title="Ollama" description="Local provider. Configured by default." action={<Badge label={local?.status ?? "Unavailable"} color={statusColor[local?.status ?? "Unavailable"]} />}>
        <Stack direction="row" spacing={1} alignItems="center">
          <TextField value={host} onChange={(e) => { setHost(e.target.value); setIsLocalDirty(true); }} placeholder="http://127.0.0.1:11434" fullWidth size="small" sx={appTextFieldSx} />
          <Switch checked={localEnabled} onChange={(e) => { setLocalEnabled(e.target.checked); setIsLocalDirty(true); }} />
          <Button size="small" variant="outlined" disabled={!isLocalDirty || isSavingLocal || !host.trim()} onClick={saveLocal} sx={{ textTransform: "none", fontWeight: 700 }}>{isSavingLocal ? "Saving..." : "Save"}</Button>
        </Stack>
      </SettingCard>

      {external?.config.enabled ? (
        <SettingCard title="OpenAI-compatible" description={external.config.api_base_url ?? "External API"} action={<Stack direction="row" spacing={1} alignItems="center"><Badge label={external.status} color={statusColor[external.status]} /><Button size="small" onClick={() => setIsExternalOpen(true)} sx={{ textTransform: "none" }}>Edit</Button></Stack>} />
      ) : null}

      <SectionHeader title="Ollama models" description="Install and remove models from local Ollama." />
      <Button onClick={() => setIsInstallerOpen((open) => !open)} endIcon={<ChevronDown size={16} style={{ transform: isInstallerOpen ? "rotate(180deg)" : undefined, transition: "transform 150ms ease" }} />} sx={{ justifyContent: "space-between", textTransform: "none", color: "text.primary", fontWeight: 700, px: 0, py: 1 }}>
        Model installer
      </Button>
      <Collapse in={isInstallerOpen}>
        <Stack spacing={1.5} sx={{ pb: 2 }}>
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField value={newModelName} onChange={(e) => setNewModelName(e.target.value)} placeholder="e.g. llama3, deepseek-r1:7b" fullWidth size="small" disabled={isPulling} sx={appTextFieldSx} />
            <Button variant="contained" disableElevation onClick={pullModel} disabled={isPulling || !newModelName.trim()} startIcon={<Download size={15} />} sx={{ textTransform: "none", fontWeight: 700 }}>Pull</Button>
          </Box>
          {isPulling && ollama.pullProgress ? <Box sx={{ ...appPanelSx, py: 1 }}><Stack direction="row" justifyContent="space-between"><Typography sx={{ fontSize: 12 }}>Pulling {ollama.pullingModel}: {ollama.pullProgress.status}</Typography><IconButton size="small" onClick={() => void ollama.cancelPull()}><XCircle size={15} /></IconButton></Stack><LinearProgress /></Box> : null}
          <Stack direction="row" justifyContent="space-between" alignItems="center"><Typography sx={{ fontSize: 13, fontWeight: 700 }}>Installed models</Typography><IconButton size="small" onClick={refreshModels} disabled={isRefreshing}><RefreshCw size={15} /></IconButton></Stack>
          {ollama.localModels.length === 0 ? <Typography sx={{ fontSize: 12, color: "text.secondary" }}>No local models found.</Typography> : null}
          {ollama.localModels.map((model) => <Stack key={model.name} direction="row" justifyContent="space-between" alignItems="center"><Box><Typography sx={{ fontSize: 13, fontWeight: 600 }}>{model.name}</Typography><Typography sx={{ fontSize: 12, color: "text.secondary" }}>{formatFileSize(model.size)}</Typography></Box><IconButton size="small" onClick={() => void deleteModel(model.name)}><Trash2 size={15} /></IconButton></Stack>)}
        </Stack>
      </Collapse>

      <Dialog open={isExternalOpen} onClose={() => setIsExternalOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 18, fontWeight: 700 }}>Add provider<IconButton size="small" onClick={() => setIsExternalOpen(false)}><X size={18} /></IconButton></DialogTitle>
        <DialogContent>
          <Typography sx={{ mb: 2, fontSize: 12, color: "text.secondary" }}>OpenAI API-compatible connection. API key optional for local servers.</Typography>
          <Stack spacing={2}>
            <TextField label="API base URL" value={apiBaseUrl} onChange={(e) => setApiBaseUrl(e.target.value)} placeholder="https://api.openai.com/v1" required fullWidth size="small" />
            <TextField label="API key (optional)" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." type="password" autoComplete="off" fullWidth size="small" />
            <SettingCard title="Enabled" description="Show models from this provider." action={<Switch checked={externalEnabled} onChange={(e) => setExternalEnabled(e.target.checked)} />} />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}><Button onClick={() => setIsExternalOpen(false)} sx={{ textTransform: "none" }}>Cancel</Button><Button variant="contained" disableElevation disabled={!apiBaseUrl.trim() || isSavingExternal} onClick={saveExternal} sx={{ textTransform: "none", fontWeight: 700 }}>{isSavingExternal ? "Saving..." : "Save"}</Button></DialogActions>
      </Dialog>
    </Stack>
  );
}
