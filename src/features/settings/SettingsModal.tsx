import { useEffect, useState } from "react";
import { Box } from "@/components/ui/Box";
import { Button } from "@/components/ui/button";
import { ButtonBase } from "@/components/ui/button-base";
import { Stack } from "@/components/ui/Stack";
import { TextField } from "@/components/ui/text-field";
import { Typography } from "@/components/ui/Typography";
import {
  AppDialogBody,
  AppDialogFrame,
  AppDialogHeader,
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
import { cn } from "@/lib/utils";
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
import { useSettingsStore } from "@/store/settingsStore";
import { clearUpdateState, simulateUpdateProgress } from "@/store/updateStore";

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
      className={cn(
        "flex h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        isActive && "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        mobile && "h-8 w-auto shrink-0 whitespace-nowrap px-3",
      )}
    >
      {!mobile && <Icon size={16} />}
      <Typography as="span" color="inherit" className="text-[13px] font-medium">
        {item.label}
      </Typography>
    </ButtonBase>
  );
}

export function SettingsModal({ isOpen, onClose, initialTab = "general" }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [allMounted, setAllMounted] = useState(false);
  const devMode = useDevStore((s) => s.devMode);
  const experimentalEnabled = useSettingsStore((state) => state.general.experimentalFeatures);
  const sidebarItems = devMode
    ? [
        ...SIDEBAR_ITEMS,
        ...(experimentalEnabled ? [MEMORY_ITEM] : []),
        { id: "developer" as const, label: "Developer", icon: Terminal },
      ]
    : [...SIDEBAR_ITEMS, ...(experimentalEnabled ? [MEMORY_ITEM] : [])];

  const activeItem = [...sidebarItems, ADVANCED_ITEM].find((item) => item.id === activeTab);
  const panelItems = [...sidebarItems, ADVANCED_ITEM];

  useEffect(() => {
    if (!isOpen) return;
    const validIds = new Set([...sidebarItems, ADVANCED_ITEM].map((i) => i.id));
    if (validIds.has(initialTab)) {
      setActiveTab(initialTab);
    } else {
      setActiveTab(sidebarItems[0]?.id ?? "general");
    }
  }, [initialTab, isOpen]);

  useEffect(() => {
    if (!experimentalEnabled && activeTab === "memory") setActiveTab("advanced");
  }, [activeTab, experimentalEnabled]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setAllMounted(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <AppDialogFrame open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Box
        className="flex h-full min-h-0"
      >
        <Box
          as="aside"
          className="hidden w-[244px] shrink-0 flex-col border-r border-border/60 p-3 md:flex"
        >
          <Stack as="nav" spacing={1}>
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
          <Box className="flex-1" />
          <Box>
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
          className="flex min-w-0 flex-1 flex-col"
        >
          <AppDialogHeader
            title={activeItem?.label ?? "Settings"}
            onClose={onClose}
          />

          <Box
            className="flex gap-2 overflow-x-auto border-b border-border/60 px-4 pb-3 md:hidden"
          >
            {panelItems.map((item) => {
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
            <Box className="min-h-[400px] w-full">
              <Box className={activeTab !== "general" ? "hidden" : ""}><GeneralTab /></Box>
              {(allMounted || activeTab === "profile") && <Box className={activeTab !== "profile" ? "hidden" : ""}><ProfileTab /></Box>}
              {(allMounted || activeTab === "connections") && <Box className={activeTab !== "connections" ? "hidden" : ""}><ConnectionsTab /></Box>}
              {(allMounted || activeTab === "personalisation") && <Box className={activeTab !== "personalisation" ? "hidden" : ""}><PersonalisationTab /></Box>}
              {(allMounted || activeTab === "speech") && <Box className={activeTab !== "speech" ? "hidden" : ""}><SpeechTab /></Box>}
              {(allMounted || activeTab === "data-controls") && <Box className={activeTab !== "data-controls" ? "hidden" : ""}><DataControlsTab /></Box>}
              {(allMounted || activeTab === "about") && <Box className={activeTab !== "about" ? "hidden" : ""}><AboutTab /></Box>}
              {experimentalEnabled && (allMounted || activeTab === "memory") && <Box className={activeTab !== "memory" ? "hidden" : ""}><MemoryTab /></Box>}
              {(allMounted || activeTab === "advanced") && <Box className={activeTab !== "advanced" ? "hidden" : ""}><AdvancedTab /></Box>}
              {(allMounted || activeTab === "developer") && <Box className={activeTab !== "developer" ? "hidden" : ""}><DeveloperTab onClose={onClose} /></Box>}
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
          >
            {isExecuting ? "Running..." : "Execute"}
          </Button>
        }
      >
        {result ? (
          <Box
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
        <Button size="small" variant="outlined" onClick={simulateUpdateProgress}>
          Download
        </Button>
      } />
      <SettingCard title="Clear Update State" action={
        <Button size="small" variant="outlined" onClick={clearUpdateState}>
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
            >
              Force Idle
            </Button>
            <Button
              size="small" variant="outlined"
              onClick={() => idleManager.forceActive()}
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
          >
            Exit Dev Mode
          </Button>
        }
      />
    </Stack>
  );
}
