import { useState } from "react";
import { Box, Button, Stack, TextField, Typography } from "@mui/material";
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
  AlertTriangle,
  Volume2,
  Cpu,
} from "lucide-react";
import { SettingCard, SectionHeader } from "./SettingComponents";
import { useDevStore } from "@/store/devStore";
import { useNotify } from "@/hooks/useNotify";
import { loggedInvoke } from "@/lib/utils";
import { GeneralTab } from "./tabs/GeneralTab";
import { PersonalisationTab } from "./tabs/PersonalisationTab";
import { SpeechTab } from "./tabs/SpeechTab";
import { DataControlsTab } from "./tabs/DataControlsTab";
import { AboutTab } from "./tabs/AboutTab";
import { ConnectionsTab } from "./tabs/ConnectionsTab";
import { APP_DIALOG_SIDEBAR_WIDTH } from "@/components/ui/appDialog";
type SettingsModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const SIDEBAR_ITEMS = [
  { id: "general", label: "General", icon: Settings },
  { id: "connections", label: "Connections", icon: Cpu },
  { id: "personalisation", label: "Personalisation", icon: User },
  { id: "speech", label: "Speech", icon: Volume2 },
  { id: "data-controls", label: "Data Controls", icon: Shield },
  { id: "about", label: "About", icon: Info },
] as const;

type SettingsTab = (typeof SIDEBAR_ITEMS)[number]["id"] | "developer";

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("general");
  const devMode = useDevStore((s) => s.devMode);

  const sidebarItems = devMode
    ? [
        ...SIDEBAR_ITEMS,
        { id: "developer" as const, label: "Developer", icon: Terminal },
      ]
    : SIDEBAR_ITEMS;

  const activeItem = sidebarItems.find((item) => item.id === activeTab);

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
                    cursor: "pointer",
                    textAlign: "left",
                    color: isActive ? "text.primary" : "text.secondary",
                    bgcolor: isActive ? "action.hover" : "transparent",
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
            {sidebarItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <Box
                  key={item.id}
                  component="button"
                  onClick={() => setActiveTab(item.id)}
                  sx={{
                    px: { xs: 1.5, sm: 1.25 },
                    py: { xs: 1, sm: 0.75 },
                    bgcolor: isActive ? "action.hover" : "transparent",
                    color: isActive ? "text.primary" : "text.secondary",
                    whiteSpace: "nowrap",
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: "pointer",
                    scrollSnapAlign: "start",
                  }}
                >
                  {item.label}
                </Box>
              );
            })}
          </Box>

          <AppDialogBody>
            <Box key={activeTab}>
              {activeTab === "general" && <GeneralTab />}
              {activeTab === "connections" && <ConnectionsTab />}
              {activeTab === "personalisation" && <PersonalisationTab />}
              {activeTab === "speech" && <SpeechTab />}
              {activeTab === "data-controls" && <DataControlsTab />}
              {activeTab === "about" && <AboutTab />}
              {activeTab === "developer" && <DeveloperTab />}
            </Box>
          </AppDialogBody>
        </Box>
      </Box>
    </AppDialogFrame>
  );
}

function DeveloperTab() {
  const notify = useNotify();
  const [isClearing, setIsClearing] = useState(false);
  const [sql, setSql] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [result, setResult] = useState<{
    columns: string[];
    rows: string[][];
  } | null>(null);

  const handleClearDb = async () => {
    if (
      !confirm(
        "This will DELETE ALL conversations, messages, users, and sessions. Continue?",
      )
    )
      return;
    setIsClearing(true);
    try {
      const res = await loggedInvoke<{ success: boolean; message: string }>(
        "clear_database",
      );
      if (res.success) {
        notify.success(res.message);
      }
    } catch (err) {
      notify.error("Failed to clear database", err as string);
    } finally {
      setIsClearing(false);
    }
  };

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

      <SettingCard
        title="Clear Database"
        description="Delete all conversations, messages, users, and sessions."
        action={
          <Button
            size="small"
            variant="outlined"
            color="error"
            onClick={handleClearDb}
            disabled={isClearing}
            startIcon={<AlertTriangle size={14} />}
            sx={{ textTransform: "none", fontWeight: 700 }}
          >
            {isClearing ? "Clearing..." : "Clear All Data"}
          </Button>
        }
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
          sx={{
            ...appTextFieldSx,
            "& .MuiInputBase-root": {
              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
              fontSize: 13,
            },
          }}
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
              <table
                style={{
                  borderCollapse: "collapse",
                  width: "100%",
                  fontSize: 12,
                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                }}
              >
                <thead>
                  <tr>
                    {result.columns.map((col, i) => (
                      <th
                        key={i}
                        style={{
                          textAlign: "left",
                          padding: "4px 8px",
                          borderBottom: "2px solid #ccc",
                          fontWeight: 700,
                        }}
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          style={{
                            padding: "4px 8px",
                            borderBottom: "1px solid #eee",
                            whiteSpace: "pre-wrap",
                          }}
                        >
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
