import { useEffect, useState } from "react";
import { Box, Button, ButtonBase, Stack, TextField, Typography } from "@mui/material";
import {
  AppDialogBody,
  AppDialogFrame,
  AppDialogHeader,
  appTextFieldSx,
} from "@/components/ui/appDialog";
import {
  Settings,
  User,
  Shield,
  Info,
  Terminal,
  Play,
  Volume2,
  Cpu,
  SlidersHorizontal,
  Brain,
  CircleUserRound,
  type LucideIcon,
} from "lucide-react";
import { SettingCard, SectionHeader } from "./SettingComponents";
import { useDevStore } from "@/store/devStore";
import { useNotify } from "@/hooks/useNotify";
import { loggedInvoke } from "@/lib/utils/utils";
import { GeneralTab } from "./tabs/GeneralTab";
import { ProfileTab } from "./tabs/ProfileTab";
import { PersonalisationTab } from "./tabs/PersonalisationTab";
import { SpeechTab } from "./tabs/SpeechTab";
import { DataControlsTab } from "./tabs/DataControlsTab";
import { AboutTab } from "./tabs/AboutTab";
import { ConnectionsTab } from "./tabs/ConnectionsTab";
import { AdvancedTab } from "./tabs/AdvancedTab";
import { MemoryTab } from "@/features/memory/MemoryTab";
import { idleManager } from "@/lib/idle";
import { APP_DIALOG_SIDEBAR_WIDTH } from "@/components/ui/appDialog";
import { useSettingsStore } from "@/store/settingsStore";

export type SettingsTab =
  | "general"
  | "profile"
  | "connections"
  | "personalisation"
  | "speech"
  | "data-controls"
  | "about"
  | "developer"
  | "advanced"
  | "memory";

type SettingsNavItem = {
  id: SettingsTab;
  label: string;
  icon: LucideIcon;
};

type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: SettingsTab;
};

const SIDEBAR_ITEMS: SettingsNavItem[] = [
  { id: "general", label: "General", icon: Settings },
  { id: "profile", label: "Profile", icon: CircleUserRound },
  { id: "connections", label: "Connections", icon: Cpu },
  { id: "personalisation", label: "Personalisation", icon: User },
  { id: "speech", label: "Speech", icon: Volume2 },
  { id: "data-controls", label: "Data Controls", icon: Shield },
  { id: "about", label: "About", icon: Info },
];

const ADVANCED_ITEM: SettingsNavItem = {
  id: "advanced",
  label: "Advanced",
  icon: SlidersHorizontal,
};

const MEMORY_ITEM: SettingsNavItem = {
  id: "memory",
  label: "Memory",
  icon: Brain,
};

function SettingsNavButton({
  item,
  isActive,
  mobile = false,
  onClick,
}: {
  item: SettingsNavItem;
  isActive: boolean;
  mobile?: boolean;
  onClick: () => void;
}) {
  const Icon = item.icon;

  return (
    <ButtonBase
      onClick={onClick}
      sx={(theme) => ({
        justifyContent: "flex-start",
        borderRadius: theme.app.radius.pill,
        bgcolor: isActive ? "action.hover" : "transparent",
        color: isActive ? "text.primary" : "text.secondary",
        ...(mobile
          ? {
              px: { xs: 1.5, sm: 1.25 },
              py: { xs: 1, sm: 0.75 },
              whiteSpace: "nowrap",
              scrollSnapAlign: "start",
            }
          : {
              width: "100%",
              gap: 1.5,
              px: 1.5,
              py: 0.85,
              "&:hover": {
                bgcolor: "action.hover",
                color: "text.primary",
              },
            }),
      })}
    >
      {!mobile && <Icon size={16} />}
      <Typography sx={{ fontSize: 13, fontWeight: mobile ? 500 : isActive ? 600 : 500 }}>
        {item.label}
      </Typography>
    </ButtonBase>
  );
}

export function SettingsModal({ isOpen, onClose, initialTab = "general" }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const devMode = useDevStore((s) => s.devMode);
  const experimentalEnabled = useSettingsStore((state) => state.general.experimentalFeatures);
  useEffect(() => {
    if (isOpen) setActiveTab(initialTab);
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (!experimentalEnabled && activeTab === "memory") setActiveTab("advanced");
  }, [activeTab, experimentalEnabled]);

  const sidebarItems = devMode
    ? [
        ...SIDEBAR_ITEMS,
        ...(experimentalEnabled ? [MEMORY_ITEM] : []),
        { id: "developer" as const, label: "Developer", icon: Terminal },
      ]
    : [...SIDEBAR_ITEMS, ...(experimentalEnabled ? [MEMORY_ITEM] : [])];

  const activeItem = [...sidebarItems, ADVANCED_ITEM].find((item) => item.id === activeTab);

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
          boxSizing: "border-box",
        }}
      >
        <Box
          component="aside"
          sx={{
            display: { xs: "none", md: "flex" },
            flexDirection: "column",
            height: "100%",
            minHeight: 0,
            boxSizing: "border-box",
            bgcolor: "transparent",
            p: 2,
          }}
        >
          <Stack component="nav" spacing={0.5}>
            {sidebarItems.map((item) => {
              const isActive = activeTab === item.id;

              return (
                <SettingsNavButton
                  key={item.id}
                  item={item}
                  isActive={isActive}
                  onClick={() => setActiveTab(item.id)}
                />
              );
            })}
          </Stack>
          <Box sx={{ flex: 1 }} />
          <Box sx={{ pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
            {(() => {
              const isActive = activeTab === ADVANCED_ITEM.id;
              return (
                <SettingsNavButton
                  onClick={() => setActiveTab(ADVANCED_ITEM.id)}
                  item={ADVANCED_ITEM}
                  isActive={isActive}
                />
              );
            })()}
          </Box>
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
              scrollSnapType: "x mandatory",
              borderBottom: "1px solid",
              borderColor: "divider",
              position: "sticky",
              top: 0,
              zIndex: 1,
              bgcolor: "background.paper",
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": { display: "none" },
            }}
          >
            {[...sidebarItems, ADVANCED_ITEM].map((item) => {
              const isActive = activeTab === item.id;
              return (
                <SettingsNavButton
                  key={item.id}
                  item={item}
                  isActive={isActive}
                  mobile
                  onClick={() => setActiveTab(item.id)}
                />
              );
            })}
          </Box>

          <AppDialogBody>
            <Box key={activeTab}>
              {activeTab === "general" && <GeneralTab />}
              {activeTab === "profile" && <ProfileTab />}
              {activeTab === "connections" && <ConnectionsTab />}
              {activeTab === "personalisation" && <PersonalisationTab />}
              {activeTab === "speech" && <SpeechTab />}
              {activeTab === "data-controls" && <DataControlsTab />}
              {activeTab === "about" && <AboutTab />}
              {activeTab === "memory" && experimentalEnabled && <MemoryTab />}
              {activeTab === "advanced" && <AdvancedTab />}
              {activeTab === "developer" && <DeveloperTab onClose={onClose} />}
            </Box>
          </AppDialogBody>
        </Box>
      </Box>
    </AppDialogFrame>
  );
}

function DeveloperTab({ onClose }: { onClose: () => void }) {
  const notify = useNotify();
  const [sql, setSql] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<{
    columns: string[];
    rows: string[][];
  } | null>(null);

  const handleExecuteSql = async () => {
    if (!sql.trim()) return;
    setIsExecuting(true);
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
          setResult({
            columns: [],
            rows: [[`${res.rows_affected} row(s) affected`]],
          });
        } else if (res.columns && res.rows) {
          setResult({
            columns: res.columns,
            rows: res.rows.map((r: unknown[]) =>
              r.map((v) => String(v ?? "NULL")),
            ),
          });
        }
      }
    } catch (err) {
      notify.error("SQL error", err as string);
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <Stack spacing={0}>
      <SectionHeader
        title="Developer Tools"
        description="Dangerous operations. These cannot be undone."
      />

      <SettingCard title="SQL Runner">
        <TextField
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          placeholder="SELECT * FROM conversations;"
          multiline
          minRows={4}
          maxRows={12}
          fullWidth
          size="small"
          sx={[
            appTextFieldSx,
            {
            "& .MuiInputBase-root": {
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 13,
            },
            },
          ]}
        />
      </SettingCard>

      <SettingCard
        title="Execute"
        action={
          <Button
            size="small"
            variant="contained"
            disableElevation
            onClick={handleExecuteSql}
            disabled={isExecuting || !sql.trim()}
            startIcon={<Play size={14} />}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {isExecuting ? "Running..." : "Execute"}
          </Button>
        }
      >
        {result ? (
          <Box
            sx={(theme) => ({
              p: 1.5,
              borderRadius: theme.app.radius.control,
              border: "1px solid",
              borderColor: "divider",
              bgcolor: "background.paper",
              overflow: "auto",
              maxHeight: 400,
            })}
          >
            {result.columns.length > 0 ? (
              <table className="settings-sql-result-table">
                <thead>
                  <tr>
                    {result.columns.map((col, i) => (
                      <th key={i}>
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j}>
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              result.rows.map((row, i) => (
                <Typography
                  key={i}
                  sx={{
                    fontSize: 13,
                    fontFamily: "monospace",
                    color: "text.secondary",
                  }}
                >
                  {row[0]}
                </Typography>
              ))
            )}
          </Box>
        ) : null}
      </SettingCard>

      <SectionHeader title="Update Tester" description="Simulate the update flow to test the UI." />
      <SettingCard title="Simulate Update Download" action={
        <Button size="small" variant="outlined" onClick={() => import("@/store/updateStore").then(m => m.simulateUpdateProgress())}
          sx={{ textTransform: "none", fontWeight: 700 }}>
          Download
        </Button>
      } />
      <SettingCard title="Clear Update State" action={
        <Button size="small" variant="outlined" onClick={() => import("@/store/updateStore").then(m => m.clearUpdateState())}
          sx={{ textTransform: "none", fontWeight: 700 }}>
          Clear
        </Button>
      } />
      <SettingCard
        title="Test Release Notes"
        description="Show the release notes modal with confetti for the current version."
        action={
          <Button
            size="small"
            variant="outlined"
            onClick={() => {
              window.dispatchEvent(new CustomEvent("force-release-notes"));
              onClose();
            }}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Show
          </Button>
        }
      />
      <SectionHeader title="Idle System" description="Force idle state transitions for testing." />
      <SettingCard
        title="Idle State"
        description={`Current: ${import.meta.env.DEV ? idleManager.state : 'n/a'}`}
        action={
          <Stack direction="row" spacing={1}>
            <Button
              size="small" variant="outlined"
              onClick={() => idleManager.forceIdle()}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              Force Idle
            </Button>
            <Button
              size="small" variant="outlined"
              onClick={() => idleManager.forceActive()}
              sx={{ textTransform: "none", fontWeight: 700 }}
            >
              Force Active
            </Button>
          </Stack>
        }
      />
      <SettingCard
        title="Unload Whisper Model"
        description="Release the dictation model from memory."
        action={
          <Button
            size="small" variant="outlined"
            onClick={async () => {
              try {
                const { invoke } = await import('@tauri-apps/api/core')
                await invoke('release_whisper_model')
                notify.success('Model released')
              } catch { notify.error('No model loaded or unavailable') }
            }}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Release
          </Button>
        }
      />
      <SettingCard
        title="Deactivate Dev Mode"
        description="Exit developer mode and hide this tab."
        action={
          <Button
            size="small"
            variant="text"
            onClick={() => useDevStore.getState().actions.setDevMode(false)}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            Exit Dev Mode
          </Button>
        }
      />
    </Stack>
  );
}
