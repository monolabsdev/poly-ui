// Design: Quiet instrument panel — fixed-width shell, soft contrast, precise spacing.
import {
  APP_DIALOG_SIDEBAR_WIDTH,
  AppDialogBody,
  AppDialogFrame,
  AppDialogHeader,
  appFadeInSx,
  appPanelSx,
  appTextFieldSx,
} from "@/components/ui/appDialog";
import { useSettingsStore } from "@/store/settingsStore";
import { SystemPrompt, useModelStore } from "@/store/modelStore";
import { ThemeMode, useThemeStore } from "@/store/themeStore";
import { useToolStore, type ToolDefinition } from "@/store/toolStore";
import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
  useTheme,
} from "@mui/material";
import {
  Box as BoxIcon,
  Check,
  Edit2,
  Monitor,
  Moon,
  Plus,
  ScrollText,
  Settings,
  Sun,
  Trash2,
  Wrench,
  Globe,
  Lock,
  RefreshCw,
  Terminal,
  AlertTriangle,
  Play,
} from "lucide-react";
import { ModelManagement } from "./ModelManagement";
import {
  SettingCard,
  SectionHeader,
  Badge,
  EmptyState,
  selectSx,
} from "./SettingComponents";
import { useProviderStore, ProviderStatusResponse, ProviderStatus, ProviderConfig } from "@/services/providers";
import { useDevStore } from "@/store/devStore";
import { useNotify } from "@/hooks/useNotify";
import { loggedInvoke } from "@/lib/utils";

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const SIDEBAR_ITEMS = [
  { id: "general", label: "General", icon: Settings },
  { id: "providers", label: "Providers", icon: Globe },
  { id: "models", label: "Models", icon: BoxIcon },
  { id: "tools", label: "Tools", icon: Wrench },
  { id: "prompts", label: "Prompt Library", icon: ScrollText },
] as const;

const THEME_OPTIONS = [
  { id: "light", label: "Light", icon: Sun },
  { id: "dark", label: "Dark", icon: Moon },
  { id: "system", label: "System", icon: Monitor },
] as const;

type SettingsTab = (typeof SIDEBAR_ITEMS)[number]["id"] | "developer";

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const { ollamaConfig, actions: settingsActions } = useSettingsStore();
  const { mode, setMode } = useThemeStore();
  const [baseUrl, setBaseUrl] = useState(ollamaConfig.baseUrl);
  const [isSavingBaseUrl, setIsSavingBaseUrl] = useState(false);
  const [baseUrlError, setBaseUrlError] = useState<string | null>(null);

  useEffect(() => {
    setBaseUrl(ollamaConfig.baseUrl);
  }, [ollamaConfig.baseUrl]);

  const devMode = useDevStore((s) => s.devMode);
  const sidebarItems = devMode
    ? [...SIDEBAR_ITEMS, { id: "developer" as const, label: "Developer", icon: Terminal }]
    : SIDEBAR_ITEMS;

  const activeItem = sidebarItems.find((item) => item.id === activeTab);

  const { providers, actions: providerActions } = useProviderStore();

  const handleSaveBaseUrl = async () => {
    setIsSavingBaseUrl(true);
    setBaseUrlError(null);

    try {
      const ollamaLocal = providers.find(p => p.provider_type === "OllamaLocal");
      if (ollamaLocal) {
        await providerActions.updateConfig({
          ...ollamaLocal.config,
          ollama_host: baseUrl
        });
      }
      await settingsActions.setOllamaConfig({ baseUrl });
    } catch (err: any) {
      setBaseUrlError(err.message || "Failed to save settings");
    } finally {
      setIsSavingBaseUrl(false);
    }
  };

  return (
    <AppDialogFrame open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: {
            xs: "1fr",
            md: `${APP_DIALOG_SIDEBAR_WIDTH}px 1fr`,
          },
          width: "100%",
          height: "100%",
          minWidth: 0,
        }}
      >
        <Box
          component="aside"
          sx={{
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            minHeight: 0,
            bgcolor: "transparent",
            p: 2,
          }}
        >
          <Stack component="nav" spacing={0.5}>
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;

              return (
                <Box
                  key={item.id}
                  component="button"
                  onClick={() => setActiveTab(item.id)}
                  sx={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    px: 1.5,
                    py: 0.85,
                    borderRadius: "8px",
                    cursor: "pointer",
                    textAlign: "left",
                    color: isActive ? "text.primary" : "text.secondary",
                    bgcolor: isActive ? "action.hover" : "transparent",
                    transition: "background 100ms ease, color 100ms ease",
                    "&:hover": {
                      bgcolor: "action.hover",
                      color: "text.primary",
                    },
                  }}
                >
                  <Icon size={16} />
                  <Typography
                    sx={{ fontSize: 13, fontWeight: isActive ? 600 : 500 }}
                  >
                    {item.label}
                  </Typography>
                </Box>
              );
            })}
          </Stack>
        </Box>

        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            minWidth: 0,
            minHeight: 0,
          }}
        >
          <AppDialogHeader
            title={activeItem?.label ?? "Settings"}
            onClose={onClose}
          />

          <Box
            sx={{
              display: { xs: "flex", md: "none" },
              gap: 1,
              px: 2.5,
              py: 1.5,
              overflowX: "auto",
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            {sidebarItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <Box
                  key={item.id}
                  component="button"
                  onClick={() => setActiveTab(item.id)}
                  sx={{
                    px: 1.25,
                    py: 0.75,
                    borderRadius: "8px",
                    bgcolor: isActive ? "action.hover" : "transparent",
                    color: isActive ? "text.primary" : "text.secondary",
                    whiteSpace: "nowrap",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  {item.label}
                </Box>
              );
            })}
          </Box>

          <AppDialogBody>
            <Box key={activeTab} sx={appFadeInSx}>
              {activeTab === "general" && (
                <GeneralTab
                  mode={mode}
                  setMode={setMode}
                  baseUrl={baseUrl}
                  setBaseUrl={setBaseUrl}
                  savedBaseUrl={ollamaConfig.baseUrl}
                  isSavingBaseUrl={isSavingBaseUrl}
                  baseUrlError={baseUrlError}
                  onSaveBaseUrl={handleSaveBaseUrl}
                />
              )}
              {activeTab === "providers" && <ProvidersTab />}
              {activeTab === "models" && <ModelManagement />}
              {activeTab === "tools" && <ToolsTab />}
              {activeTab === "prompts" && <PromptLibraryTab />}
              {activeTab === "developer" && <DeveloperTab />}
            </Box>
          </AppDialogBody>
        </Box>
      </Box>
    </AppDialogFrame>
  );
}

function GeneralTab({
  mode,
  setMode,
  baseUrl,
  setBaseUrl,
  savedBaseUrl,
  isSavingBaseUrl,
  baseUrlError,
  onSaveBaseUrl,
}: {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  baseUrl: string;
  setBaseUrl: (value: string) => void;
  savedBaseUrl: string;
  isSavingBaseUrl: boolean;
  baseUrlError: string | null;
  onSaveBaseUrl: () => void;
}) {
  return (
    <Stack spacing={0}>
      <SectionHeader title="General Settings" />
      <SettingCard
        title="Theme"
        description="Choose how OpenBench should render the interface."
        action={
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <Select
              value={mode}
              onChange={(e) => setMode(e.target.value as ThemeMode)}
              sx={selectSx}
            >
              {THEME_OPTIONS.map((option) => (
                <MenuItem key={option.id} value={option.id}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <option.icon size={14} />
                    <span>{option.label}</span>
                  </Stack>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        }
      />

      <SettingCard
        title="Ollama Base URL"
        description="The local Ollama server endpoint used for model and chat requests."
        action={
          <Button
            size="small"
            variant="text"
            onClick={onSaveBaseUrl}
            disabled={isSavingBaseUrl || baseUrl === savedBaseUrl}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {isSavingBaseUrl ? "Saving..." : "Save"}
          </Button>
        }
      >
        <TextField
          value={baseUrl}
          onChange={(e) => setBaseUrl(e.target.value)}
          placeholder="http://localhost:11434"
          fullWidth
          size="small"
          sx={appTextFieldSx}
        />
        {baseUrlError && (
          <Alert severity="error" sx={{ mt: 1.5, borderRadius: "8px" }}>
            {baseUrlError}
          </Alert>
        )}
      </SettingCard>

      <SettingCard title="About OpenBench">
        <Typography
          sx={{ fontSize: 13, color: "text.secondary", lineHeight: 1.65 }}
        >
          OpenBench is a local-first AI client for comparing and interacting
          with various models. All your data is stored locally in your machine.
        </Typography>
      </SettingCard>
    </Stack>
  );
}

function PromptLibraryTab() {
  const theme = useTheme();
  const { systemPrompts, activeSystemPromptId, actions } = useModelStore();
  const [editingPrompt, setEditingPrompt] = useState<SystemPrompt | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const handleSave = (prompt: SystemPrompt) => {
    if (isAdding) {
      actions.addSystemPrompt(prompt);
      setIsAdding(false);
    } else {
      actions.updateSystemPrompt(prompt);
    }
    setEditingPrompt(null);
  };

  const handleAddNew = () => {
    setEditingPrompt({
      id: crypto.randomUUID(),
      name: "New Prompt",
      content: "",
      category: "General",
    });
    setIsAdding(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete this prompt?")) {
      actions.deleteSystemPrompt(id);
    }
  };

  const categories = Array.from(
    new Set(systemPrompts.map((prompt) => prompt.category || "General")),
  );

  return (
    <Stack spacing={0}>
      <SectionHeader
        title="System Prompts"
        description="Choose, add, edit, or delete reusable system prompts."
        action={
          !editingPrompt ? (
            <Button
              size="small"
              startIcon={<Plus size={16} />}
              onClick={handleAddNew}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              Add New
            </Button>
          ) : null
        }
      />

      {editingPrompt ? (
        <Box sx={appPanelSx}>
          <Stack spacing={2}>
            <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
              <TextField
                label="Name"
                size="small"
                fullWidth
                value={editingPrompt.name}
                onChange={(e) =>
                  setEditingPrompt({ ...editingPrompt, name: e.target.value })
                }
                sx={appTextFieldSx}
              />
              <TextField
                label="Category"
                size="small"
                fullWidth
                value={editingPrompt.category || ""}
                onChange={(e) =>
                  setEditingPrompt({
                    ...editingPrompt,
                    category: e.target.value,
                  })
                }
                placeholder="e.g. Coding, Creative, etc."
                sx={appTextFieldSx}
              />
            </Stack>
            <TextField
              label="System Message"
              multiline
              minRows={8}
              fullWidth
              value={editingPrompt.content}
              onChange={(e) =>
                setEditingPrompt({ ...editingPrompt, content: e.target.value })
              }
              sx={appTextFieldSx}
            />
            <Stack direction="row" justifyContent="flex-end" spacing={1}>
              <Button
                size="small"
                variant="text"
                onClick={() => {
                  setEditingPrompt(null);
                  setIsAdding(false);
                }}
              >
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                disableElevation
                onClick={() => handleSave(editingPrompt)}
              >
                Save
              </Button>
            </Stack>
          </Stack>
        </Box>
      ) : (
        <Stack spacing={2.5}>
          {categories.map((category) => (
            <Stack key={category} spacing={1}>
              <Typography
                sx={{
                  fontSize: 11,
                  fontWeight: 800,
                  color: "text.secondary",
                  textTransform: "uppercase",
                  letterSpacing: "0.12em",
                }}
              >
                {category}
              </Typography>
              <Stack spacing={1}>
                {systemPrompts
                  .filter(
                    (prompt) => (prompt.category || "General") === category,
                  )
                  .map((prompt) => {
                    const isActive = activeSystemPromptId === prompt.id;

                    return (
                      <Box
                        key={prompt.id}
                        sx={{
                          p: 1,
                          display: "flex",
                          flexDirection: "column",
                          gap: 1,
                        }}
                      >
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={1.5}
                        >
                          <Box
                            onClick={() => actions.setSystemPrompt(prompt.id)}
                            sx={{ flex: 1, minWidth: 0, cursor: "pointer" }}
                          >
                            <Stack
                              direction="row"
                              alignItems="center"
                              spacing={1}
                            >
                              <Typography
                                sx={{
                                  fontSize: 14,
                                  fontWeight: isActive ? 800 : 700,
                                }}
                              >
                                {prompt.name}
                              </Typography>
                              {isActive && (
                                <Check
                                  size={14}
                                  color={theme.palette.primary.main}
                                />
                              )}
                            </Stack>
                            <Typography
                              noWrap
                              sx={{
                                display: "block",
                                color: "text.secondary",
                                fontSize: 12,
                                mt: 0.25,
                              }}
                            >
                              {prompt.content || "No content"}
                            </Typography>
                          </Box>
                          <IconButton
                            size="small"
                            onClick={() => setEditingPrompt(prompt)}
                            sx={{ borderRadius: "8px" }}
                          >
                            <Edit2 size={15} />
                          </IconButton>
                          <IconButton
                            size="small"
                            onClick={() => handleDelete(prompt.id)}
                            disabled={prompt.id === "default"}
                            sx={{ borderRadius: "8px" }}
                          >
                            <Trash2 size={15} />
                          </IconButton>
                        </Stack>
                      </Box>
                    );
                  })}
              </Stack>
            </Stack>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function ToolsTab() {
  const theme = useTheme();
  const tools = useToolStore((state) => state.tools);
  const isLoading = useToolStore((state) => state.isLoading);
  const { loadTools, toggleTool } = useToolStore((state) => state.actions);

  useEffect(() => {
    loadTools();
  }, [loadTools]);

  const sourceColors: Record<string, string> = {
    builtin: theme.palette.info.main,
    python: theme.palette.success.main,
    mcp: theme.palette.warning.main,
  };

  return (
    <Stack spacing={0}>
      <SectionHeader
        title="Available Tools"
        description="Tools are sent to the model so it can invoke them during conversations."
        action={
          <Button
            variant="text"
            size="small"
            onClick={() => loadTools()}
            disabled={isLoading}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {isLoading ? "Loading..." : "Reload"}
          </Button>
        }
      />

      {tools.length === 0 && !isLoading && (
        <EmptyState>
          No tools registered. Tools will appear here once the backend is
          running.
        </EmptyState>
      )}

      <Stack spacing={1}>
        {tools.map((tool: ToolDefinition) => {
          const sourceColor =
            sourceColors[tool.source] ?? theme.palette.text.secondary;

          return (
            <Box
              key={tool.name}
              sx={{
                py: 1.5,
                opacity: tool.enabled ? 1 : 0.62,
                borderBottom: "1px solid",
                borderColor: "divider",
              }}
            >
              <Stack
                direction="row"
                alignItems="center"
                justifyContent="space-between"
                spacing={2}
              >
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Stack
                    direction="row"
                    alignItems="center"
                    spacing={1}
                    sx={{ mb: 0.5 }}
                  >
                    <Typography
                      sx={{
                        fontSize: 14,
                        fontWeight: 800,
                        fontFamily:
                          "ui-monospace, SFMono-Regular, Menlo, monospace",
                        color: "text.primary",
                      }}
                    >
                      {tool.name}
                    </Typography>
                    <Badge label={tool.source} color={sourceColor} />
                    {tool.requiresApproval && (
                      <Badge
                        label="Approval"
                        color={theme.palette.warning.main}
                      />
                    )}
                  </Stack>
                  <Typography
                    noWrap
                    sx={{ fontSize: 12, color: "text.secondary" }}
                  >
                    {tool.description}
                  </Typography>
                </Box>
                <Button
                  variant={tool.enabled ? "outlined" : "text"}
                  size="small"
                  onClick={() => toggleTool(tool.name)}
                  sx={{
                    minWidth: 84,
                    textTransform: "none",
                    fontSize: 12,
                    fontWeight: 800,
                    borderColor: tool.enabled ? "divider" : "transparent",
                  }}
                >
                  {tool.enabled ? "Enabled" : "Disabled"}
                </Button>
              </Stack>
            </Box>
          );
        })}
      </Stack>
    </Stack>
  );
}

function DeveloperTab() {
  const notify = useNotify();
  const [clearing, setClearing] = useState(false);
  const [sql, setSql] = useState("");
  const [executing, setExecuting] = useState(false);
  const [result, setResult] = useState<{ columns: string[]; rows: string[][] } | null>(null);

  const handleClearDb = async () => {
    if (!confirm("This will DELETE ALL conversations, messages, users, and sessions. Continue?")) return;
    setClearing(true);
    try {
      const res = await loggedInvoke<{ success: boolean; message: string }>("clear_database");
      if (res.success) {
        notify.success(res.message);
      }
    } catch (err) {
      notify.error("Failed to clear database", err as string);
    } finally {
      setClearing(false);
    }
  };

  const handleExecuteSql = async () => {
    if (!sql.trim()) return;
    setExecuting(true);
    setResult(null);
    try {
      const res = await loggedInvoke<{
        success: boolean;
        message: string;
        rows_affected?: number;
        columns?: string[];
        rows?: unknown[][];
      }>("execute_sql", { sql });
      if (res.success) {
        notify.success(res.message);
        if (res.rows_affected !== undefined) {
          setResult({ columns: [], rows: [[`${res.rows_affected} row(s) affected`]] });
        } else if (res.columns && res.rows) {
          setResult({
            columns: res.columns,
            rows: res.rows.map((r: unknown[]) => r.map((v) => String(v ?? "NULL"))),
          });
        }
      }
    } catch (err) {
      notify.error("SQL error", err as string);
    } finally {
      setExecuting(false);
    }
  };

  return (
    <Stack spacing={0}>
      <SectionHeader title="Developer Tools" description="⚠️ Dangerous operations. These cannot be undone." />

      <SettingCard
        title="Clear Database"
        description="Delete all conversations, messages, users, and sessions. Provider configs are preserved."
        action={
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={handleClearDb}
            disabled={clearing}
            startIcon={<AlertTriangle size={14} />}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {clearing ? "Clearing..." : "Clear All Data"}
          </Button>
        }
      />

      <SectionHeader
        title="SQL Runner"
        description="Execute arbitrary SQL against the database. SELECT and PRAGMA return results; write queries return row count."
        action={
          <Button
            size="small"
            variant="contained"
            disableElevation
            onClick={handleExecuteSql}
            disabled={executing || !sql.trim()}
            startIcon={<Play size={14} />}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {executing ? "Running..." : "Execute"}
          </Button>
        }
      />

      <Box sx={{ px: 2.5, pb: 2 }}>
        <TextField
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          placeholder="SELECT * FROM conversations;"
          multiline
          minRows={4}
          maxRows={12}
          fullWidth
          size="small"
          sx={{
            ...appTextFieldSx,
            "& .MuiInputBase-root": { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 13 },
          }}
        />
      </Box>

      {result && (
        <Box sx={{ px: 2.5, pb: 2 }}>
          <Box
            sx={{
              p: 1.5,
              borderRadius: "8px",
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
              overflow: "auto",
              maxHeight: 400,
            }}
          >
            {result.columns.length > 0 ? (
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 12, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
                <thead>
                  <tr>
                    {result.columns.map((col, i) => (
                      <th key={i} style={{ textAlign: "left", padding: "4px 8px", borderBottom: "2px solid #ccc", fontWeight: 700 }}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} style={{ padding: "4px 8px", borderBottom: "1px solid #eee", whiteSpace: "pre-wrap" }}>{cell}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              result.rows.map((row, i) => (
                <Typography key={i} sx={{ fontSize: 13, fontFamily: "monospace", color: "text.secondary" }}>
                  {row[0]}
                </Typography>
              ))
            )}
          </Box>
        </Box>
      )}

      <SettingCard title="Deactivate Dev Mode">
        <Button
          size="small"
          variant="text"
          onClick={() => useDevStore.getState().actions.setDevMode(false)}
          sx={{ textTransform: "none", fontWeight: 700 }}
        >
          Exit Dev Mode
        </Button>
      </SettingCard>
    </Stack>
  );
}

function ProvidersTab() {
  const theme = useTheme();
  const { providers, loading, actions } = useProviderStore();

  useEffect(() => {
    actions.refresh();
  }, [actions]);

  const [editingConfigs, setEditingConfigs] = useState<Record<string, ProviderConfig>>({});

  const handleToggle = (provider: ProviderStatusResponse) => {
    actions.updateConfig({
      ...provider.config,
      enabled: !provider.config.enabled,
    });
  };

  const handleFieldChange = (type: string, field: string, value: string) => {
    const provider = providers.find((p) => p.provider_type === type);
    if (!provider) return;

    const currentConfig = editingConfigs[type] || provider.config;
    setEditingConfigs({
      ...editingConfigs,
      [type]: {
        ...currentConfig,
        [field]: value,
      },
    });
  };

  const handleSaveConfig = async (type: string) => {
    const config = editingConfigs[type];
    if (config) {
      await actions.updateConfig(config);
      // Clear local edit state after save
      const newEditing = { ...editingConfigs };
      delete newEditing[type];
      setEditingConfigs(newEditing);
    }
  };

  const statusColors: Record<ProviderStatus, string> = {
    Online: theme.palette.success.main,
    Offline: theme.palette.error.main,
    Reconnecting: theme.palette.warning.main,
    Unavailable: theme.palette.text.disabled,
  };

  return (
    <Stack spacing={0}>
      <SectionHeader
        title="LLM Providers"
        description="Configure and manage connections to various LLM backends."
        action={
          <Button
            size="small"
            variant="text"
            onClick={() => actions.refreshHealth()}
            disabled={loading}
            startIcon={<RefreshCw size={14} className={loading ? "animate-spin" : ""} />}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {loading ? "Refreshing..." : "Refresh Status"}
          </Button>
        }
      />

      <Stack spacing={3} sx={{ mt: 2 }}>
        {providers.map((p) => (
          <Box
            key={p.provider_type}
            sx={{
              p: 2,
              borderRadius: "12px",
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
              transition: "all 0.2s ease",
            }}
          >
            <Stack spacing={2}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Stack direction="row" alignItems="center" spacing={1.5}>
                  <Box
                    sx={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      bgcolor: statusColors[p.status],
                      boxShadow: `0 0 8px ${statusColors[p.status]}44`,
                    }}
                  />
                  <Typography sx={{ fontWeight: 800, fontSize: 14 }}>
                    {p.provider_type === "OllamaLocal" ? "Ollama (Local)" :
                     p.provider_type === "OllamaAPI" ? "Ollama (Remote API)" :
                     p.provider_type}
                  </Typography>
                  <Badge 
                    label={p.status} 
                    color={statusColors[p.status]} 
                  />
                </Stack>
                <Button
                  size="small"
                  variant={p.config.enabled ? "outlined" : "contained"}
                  onClick={() => handleToggle(p)}
                  sx={{ textTransform: "none", fontSize: 12, fontWeight: 700 }}
                >
                  {p.config.enabled ? "Disable" : "Enable"}
                </Button>
              </Stack>

              {p.config.enabled && (
                <Stack spacing={2} sx={appFadeInSx}>
                  {p.provider_type === "OllamaLocal" && (
                    <TextField
                      label="Ollama Host"
                      size="small"
                      fullWidth
                      value={(editingConfigs[p.provider_type]?.ollama_host) ?? (p.config.ollama_host || "")}
                      onChange={(e) => handleFieldChange(p.provider_type, "ollama_host", e.target.value)}
                      placeholder="http://localhost:11434"
                      sx={appTextFieldSx}
                    />
                  )}

                  {p.provider_type === "OllamaAPI" && (
                    <>
                      <TextField
                        label="API Base URL"
                        size="small"
                        fullWidth
                        value={(editingConfigs[p.provider_type]?.ollama_api_base_url) ?? (p.config.ollama_api_base_url || "")}
                        onChange={(e) => handleFieldChange(p.provider_type, "ollama_api_base_url", e.target.value)}
                        placeholder="https://api.ollama.com/v1"
                        sx={appTextFieldSx}
                      />
                      <TextField
                        label="API Key"
                        size="small"
                        fullWidth
                        type="password"
                        value={(editingConfigs[p.provider_type]?.ollama_api_key) ?? (p.config.ollama_api_key || "")}
                        onChange={(e) => handleFieldChange(p.provider_type, "ollama_api_key", e.target.value)}
                        placeholder="Enter your API key"
                        sx={appTextFieldSx}
                        InputProps={{
                          startAdornment: (
                            <Box sx={{ mr: 1, color: "text.secondary", display: "flex" }}>
                              <Lock size={14} />
                            </Box>
                          ),
                        }}
                      />
                    </>
                  )}

                  {editingConfigs[p.provider_type] && (
                    <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                      <Button
                        size="small"
                        variant="contained"
                        disableElevation
                        onClick={() => handleSaveConfig(p.provider_type)}
                        sx={{ textTransform: "none", fontWeight: 700 }}
                      >
                        Save Changes
                      </Button>
                    </Box>
                  )}

                  {(p.provider_type === "Anthropic" || p.provider_type === "OpenAI") && (
                    <Typography sx={{ fontSize: 12, color: "text.secondary", fontStyle: "italic" }}>
                      Coming soon... This provider will allow you to use official cloud APIs.
                    </Typography>
                  )}
                </Stack>
              )}
            </Stack>
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}

