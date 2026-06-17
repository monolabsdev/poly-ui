import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Slider,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import type { SelectChangeEvent } from "@mui/material";
import { RefreshCcw, Search, Trash2 } from "lucide-react";
import { appTextFieldSx } from "@/components/ui/appDialog";
import { EmptyState, SectionHeader, SettingCard, selectSx } from "@/features/settings/SettingComponents";
import { useNotify } from "@/hooks/useNotify";
import { getCurrentProviderAccountId } from "@/features/providers";
import {
  memoryClearAll,
  memoryClearScope,
  memoryDelete,
  memoryGetSettings,
  memoryList,
  memorySearch,
  memoryTestConnection,
  memoryUpdate,
  memoryUpdateSettings,
} from "./memoryClient";
import type { MemoryCategory, MemoryRecord, MemoryScope, MemorySettings } from "./types";

const scopes: MemoryScope[] = ["user", "project", "chat", "agent"];
const categories: MemoryCategory[] = [
  "identity",
  "preference",
  "goal",
  "project",
  "relationship",
  "event",
  "instruction",
  "other",
];

function localityLabel(settings: MemorySettings | null) {
  if (!settings?.enabled) return "Disabled";
  if (settings.provider === "disabled") return "Fully local";
  if (settings.locality === "remote") return "Remote";
  if (settings.locality === "partially_remote") return "Partially remote";
  return "Fully local";
}

function formatValue(value: unknown) {
  if (typeof value === "string") return value;
  return JSON.stringify(value, null, 2);
}

function parseValue(input: string) {
  try {
    return JSON.parse(input);
  } catch {
    return input;
  }
}

function defaultSettings(ownerId: string, current?: MemorySettings | null): MemorySettings {
  return {
    enabled: false,
    provider: "disabled",
    automaticExtraction: false,
    requireSensitiveConfirmation: true,
    enableUserMemory: true,
    enableProjectMemory: true,
    enableChatMemory: true,
    enableAgentMemory: true,
    allowTemporaryRecall: false,
    retrievalLimit: 8,
    tokenBudget: 600,
    extractionProviderId: null,
    extractionProvider: null,
    extractionModel: null,
    extractionApiBaseUrl: null,
    embeddingProviderId: null,
    embeddingProvider: null,
    embeddingModel: null,
    embeddingApiBaseUrl: null,
    mem0Endpoint: null,
    locality: "local",
    ...current,
    ownerId,
  };
}

export function MemoryTab() {
  const notify = useNotify();
  const ownerId = getCurrentProviderAccountId();
  const [settings, setSettings] = useState<MemorySettings | null>(null);
  const [records, setRecords] = useState<MemoryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<MemoryScope | "all">("all");
  const [category, setCategory] = useState<MemoryCategory | "all">("all");
  const [includeInactive, setIncludeInactive] = useState(false);
  const [editing, setEditing] = useState<MemoryRecord | null>(null);
  const [confirm, setConfirm] = useState<null | { title: string; body: string; run: () => Promise<void> }>(null);

  const loadSettings = useCallback(async () => {
    if (!ownerId) return;
    const next = await memoryGetSettings(ownerId);
    setSettings(defaultSettings(ownerId, next));
  }, [ownerId]);

  const loadRecords = useCallback(async () => {
    if (!ownerId) return;
    const base = {
      ownerId,
      scope: scope === "all" ? null : scope,
      scopeOwnerId: null,
      category: category === "all" ? null : category,
      includeInactive,
      includeDeleted: false,
      limit: 100,
    };
    const next = query.trim()
      ? await memorySearch({ ...base, query: query.trim() })
      : await memoryList({ ...base, includeSuperseded: includeInactive, offset: 0 });
    setRecords(next);
  }, [category, includeInactive, ownerId, query, scope]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([loadSettings(), loadRecords()])
      .catch((error) => !cancelled && notify.error("Memory load failed", String(error)))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [loadRecords, loadSettings, notify]);

  const saveSettings = useCallback(
    async (patch: Partial<MemorySettings>) => {
      if (!ownerId) return;
      const next = defaultSettings(ownerId, { ...settings, ...patch } as MemorySettings);
      setSettings(next);
      setSaving(true);
      try {
        const saved = await memoryUpdateSettings(next);
        setSettings(defaultSettings(ownerId, saved));
      } catch (error) {
        notify.error("Memory settings failed", String(error));
        void loadSettings();
      } finally {
        setSaving(false);
      }
    },
    [loadSettings, notify, ownerId, settings],
  );

  const testConnection = async () => {
    if (!ownerId) return;
    try {
      const result = await memoryTestConnection(ownerId);
      notify[result.ok ? "success" : "error"]("Memory connection", result.message);
    } catch (error) {
      notify.error("Memory connection failed", String(error));
    }
  };

  const removeMemory = (record: MemoryRecord) => {
    setConfirm({
      title: "Delete memory",
      body: record.summary,
      run: async () => {
        await memoryDelete(ownerId, record.id);
        notify.success("Memory deleted");
        await loadRecords();
      },
    });
  };

  const clearCurrentScope = () => {
    if (scope === "all") return;
    setConfirm({
      title: `Clear ${scope} memories`,
      body: "Deletes active memories in this scope for current profile.",
      run: async () => {
        await memoryClearScope(ownerId, scope, null);
        notify.success("Scope cleared");
        await loadRecords();
      },
    });
  };

  const clearAll = () => {
    setConfirm({
      title: "Clear all memories",
      body: "Deletes all memories for current profile.",
      run: async () => {
        await memoryClearAll(ownerId);
        notify.success("All memories cleared");
        await loadRecords();
      },
    });
  };

  const activeCount = useMemo(() => records.filter((record) => record.isActive && !record.deletedAt).length, [records]);
  const settingsReady = settings ?? defaultSettings(ownerId);

  if (!ownerId) {
    return <EmptyState>Memory needs profile or guest session.</EmptyState>;
  }

  return (
    <Stack spacing={0}>
      <SectionHeader
        title="Memory"
        description="Memory allows Poly UI to remember useful information across chats."
        action={<Chip size="small" label={localityLabel(settings)} />}
      />

      <SettingCard
        title="Enable memory"
        description="Disabled by default. No recall or extraction runs while off."
        action={<Switch checked={settingsReady.enabled} disabled={saving} onChange={(e) => saveSettings({ enabled: e.target.checked })} />}
      />
      <SettingCard
        title="Memory provider"
        description="Native local storage is active. Mem0 adapter lands in next phase."
        action={
          <FormControl size="small" sx={{ minWidth: 128 }}>
            <Select value={settingsReady.provider} onChange={(event) => saveSettings({ provider: event.target.value, locality: event.target.value === "disabled" ? "local" : "remote" })} sx={selectSx}>
              <MenuItem value="disabled">Disabled</MenuItem>
              <MenuItem value="mem0" disabled>Mem0</MenuItem>
            </Select>
          </FormControl>
        }
      />
      <SettingCard
        title="Automatic extraction"
        description="Runs after completed persisted turns. Temporary chats are skipped."
        action={<Switch checked={settingsReady.automaticExtraction} disabled={!settingsReady.enabled || saving} onChange={(e) => saveSettings({ automaticExtraction: e.target.checked })} />}
      />
      <SettingCard
        title="Require sensitive confirmation"
        description="Deterministic filter rejects keys, tokens, private credentials and similar secrets."
        action={<Switch checked={settingsReady.requireSensitiveConfirmation} disabled={!settingsReady.enabled || saving} onChange={(e) => saveSettings({ requireSensitiveConfirmation: e.target.checked })} />}
      />

      <SectionHeader title="Scopes" description="Scope ownership stays explicit. Project and agent memory never become global automatically." />
      {[
        ["enableUserMemory", "User memory", "Across chats for current profile."],
        ["enableProjectMemory", "Project memory", "Only inside relevant workspace or folder."],
        ["enableChatMemory", "Chat memory", "Only inside originating conversation."],
        ["enableAgentMemory", "Agent memory", "Only for matching agent configuration."],
      ].map(([key, title, description]) => (
        <SettingCard
          key={key}
          title={title}
          description={description}
          action={<Switch checked={Boolean(settingsReady[key as keyof MemorySettings])} disabled={!settingsReady.enabled || saving} onChange={(e) => saveSettings({ [key]: e.target.checked } as Partial<MemorySettings>)} />}
        />
      ))}
      <SettingCard
        title="Temporary chat recall"
        description="Off by default. Temporary chats never write persistent memories automatically."
        action={<Switch checked={settingsReady.allowTemporaryRecall} disabled={!settingsReady.enabled || saving} onChange={(e) => saveSettings({ allowTemporaryRecall: e.target.checked })} />}
      />

      <SectionHeader title="Retrieval" description="Only bounded active canonical memories are injected as untrusted context." />
      <SettingCard title="Memory retrieval limit" description={`${settingsReady.retrievalLimit} memories maximum`}>
        <Slider min={1} max={20} value={settingsReady.retrievalLimit} disabled={!settingsReady.enabled || saving} onChange={(_, value) => saveSettings({ retrievalLimit: value as number })} />
      </SettingCard>
      <SettingCard title="Memory token budget" description={`${settingsReady.tokenBudget} approximate tokens`}>
        <Slider min={100} max={2000} step={50} value={settingsReady.tokenBudget} disabled={!settingsReady.enabled || saving} onChange={(_, value) => saveSettings({ tokenBudget: value as number })} />
      </SettingCard>

      <SectionHeader
        title="Your memories"
        description={`${activeCount} active shown. Superseded memories appear when inactive records are enabled.`}
        action={
          <Stack direction="row" spacing={1}>
            <Button size="small" startIcon={<RefreshCcw size={14} />} onClick={loadRecords} sx={{ textTransform: "none" }}>Refresh</Button>
            <Button size="small" onClick={testConnection} sx={{ textTransform: "none" }}>Test</Button>
          </Stack>
        }
      />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1} sx={{ py: 1 }}>
        <TextField value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search memories" size="small" fullWidth sx={appTextFieldSx} InputProps={{ startAdornment: <Search size={14} /> }} />
        <FilterSelect label="Scope" value={scope} values={["all", ...scopes]} onChange={(value) => setScope(value as MemoryScope | "all")} />
        <FilterSelect label="Category" value={category} values={["all", ...categories]} onChange={(value) => setCategory(value as MemoryCategory | "all")} />
      </Stack>
      <SettingCard
        title="Show superseded memories"
        description="Includes inactive historical values for inspection."
        action={<Switch checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />}
      />
      <Stack spacing={1} sx={{ py: 1 }}>
        {loading ? <EmptyState>Loading memories...</EmptyState> : records.length === 0 ? <EmptyState>No memories found.</EmptyState> : records.map((record) => (
          <MemoryRow key={record.id} record={record} onEdit={setEditing} onDelete={removeMemory} />
        ))}
      </Stack>
      <Stack direction="row" spacing={1} sx={{ pt: 1 }}>
        <Button size="small" color="error" variant="outlined" disabled={scope === "all"} onClick={clearCurrentScope} startIcon={<Trash2 size={14} />} sx={{ textTransform: "none" }}>
          Clear scope
        </Button>
        <Button size="small" color="error" variant="text" onClick={clearAll} sx={{ textTransform: "none" }}>
          Clear all
        </Button>
      </Stack>

      <EditMemoryDialog record={editing} ownerId={ownerId} onClose={() => setEditing(null)} onSaved={loadRecords} />
      <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
    </Stack>
  );
}

function FilterSelect({ label, value, values, onChange }: { label: string; value: string; values: string[]; onChange: (value: string) => void }) {
  return (
    <FormControl size="small" sx={{ minWidth: 128 }}>
      <InputLabel>{label}</InputLabel>
      <Select label={label} value={value} onChange={(event: SelectChangeEvent) => onChange(event.target.value)} sx={selectSx}>
        {values.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
      </Select>
    </FormControl>
  );
}

function MemoryRow({ record, onEdit, onDelete }: { record: MemoryRecord; onEdit: (record: MemoryRecord) => void; onDelete: (record: MemoryRecord) => void }) {
  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: "8px", p: 1.25 }}>
      <Stack direction="row" justifyContent="space-between" spacing={1}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontSize: 13, fontWeight: 700, color: record.isActive ? "text.primary" : "text.secondary" }}>{record.summary}</Typography>
          <Typography sx={{ fontSize: 12, color: "text.secondary", mt: 0.25 }}>{record.canonicalKey ?? "uncategorized"} · {record.scope} · {record.category}</Typography>
        </Box>
        <Stack direction="row" spacing={0.5}>
          <Button size="small" onClick={() => onEdit(record)} sx={{ textTransform: "none" }}>Edit</Button>
          <Button size="small" color="error" onClick={() => onDelete(record)} sx={{ textTransform: "none" }}>Delete</Button>
        </Stack>
      </Stack>
      <Divider sx={{ my: 1 }} />
      <Typography component="pre" sx={{ m: 0, fontSize: 12, color: "text.secondary", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
        {formatValue(record.value)}
      </Typography>
      <details>
        <summary style={{ cursor: "pointer", fontSize: 12, marginTop: 8 }}>Metadata</summary>
        <Typography sx={{ mt: 0.75, fontSize: 11, color: "text.secondary", wordBreak: "break-word" }}>
          confidence {record.confidence.toFixed(2)} · importance {record.importance.toFixed(2)} · sync {record.syncStatus}
          <br />
          source {record.sourceChatId ?? "none"} · created {new Date(record.createdAt).toLocaleString()} · updated {new Date(record.updatedAt).toLocaleString()}
          {record.supersedesId ? <><br />supersedes {record.supersedesId}</> : null}
          {record.syncError ? <><br />sync error {record.syncError}</> : null}
        </Typography>
      </details>
    </Box>
  );
}

function EditMemoryDialog({ record, ownerId, onClose, onSaved }: { record: MemoryRecord | null; ownerId: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const notify = useNotify();
  const [summary, setSummary] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setSummary(record?.summary ?? "");
    setValue(record ? formatValue(record.value) : "");
  }, [record]);

  const save = async () => {
    if (!record) return;
    setSaving(true);
    try {
      await memoryUpdate({ ownerId, memoryId: record.id, summary, value: parseValue(value) });
      notify.success("Memory updated");
      await onSaved();
      onClose();
    } catch (error) {
      notify.error("Memory update failed", String(error));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={Boolean(record)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Edit memory</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Summary" value={summary} onChange={(e) => setSummary(e.target.value)} size="small" fullWidth sx={appTextFieldSx} />
          <TextField label="Value" value={value} onChange={(e) => setValue(e.target.value)} size="small" fullWidth multiline minRows={5} sx={appTextFieldSx} />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button onClick={save} disabled={saving || !summary.trim()} variant="contained" disableElevation sx={{ textTransform: "none" }}>Save</Button>
      </DialogActions>
    </Dialog>
  );
}

function ConfirmDialog({ confirm, onClose }: { confirm: null | { title: string; body: string; run: () => Promise<void> }; onClose: () => void }) {
  const notify = useNotify();
  const [running, setRunning] = useState(false);
  const run = async () => {
    if (!confirm) return;
    setRunning(true);
    try {
      await confirm.run();
      onClose();
    } catch (error) {
      notify.error("Memory action failed", String(error));
    } finally {
      setRunning(false);
    }
  };
  return (
    <Dialog open={Boolean(confirm)} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>{confirm?.title}</DialogTitle>
      <DialogContent><Typography sx={{ fontSize: 13, color: "text.secondary" }}>{confirm?.body}</Typography></DialogContent>
      <DialogActions>
        <Button onClick={onClose} sx={{ textTransform: "none" }}>Cancel</Button>
        <Button color="error" variant="contained" disabled={running} onClick={run} disableElevation sx={{ textTransform: "none" }}>Confirm</Button>
      </DialogActions>
    </Dialog>
  );
}
