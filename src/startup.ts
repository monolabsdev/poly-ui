import type { SystemPrompt } from "@/store/modelStore";
import { useAuthStore } from "@/store/authStore";
import { useModelStore } from "@/store/modelStore";
import { useOllamaStore } from "@/services/ollama/monitor";
import { initStoreCoordinator } from "@/store/coordinator";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";
import { backupCorruptStorageItem, startupError, startupPhase } from "@/lib/startupDiagnostics";

const SYSTEM_PROMPTS_STORAGE_KEY = "polyui.systemPrompts";

type StoredPrompts = {
  systemPrompts: SystemPrompt[];
  activeSystemPromptId: string | null;
};

let appImportPromise: Promise<typeof import("./App")> | null = null;
let startupPromise: Promise<void> | null = null;

export function loadAppModule() {
  appImportPromise ??= import("./App");
  return appImportPromise;
}

function restoreSystemPrompts() {
  try {
    const raw = localStorage.getItem(SYSTEM_PROMPTS_STORAGE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as StoredPrompts;
    if (!Array.isArray(parsed.systemPrompts)) return;

    useModelStore.setState({
      systemPrompts: parsed.systemPrompts,
      activeSystemPromptId:
        parsed.activeSystemPromptId ?? parsed.systemPrompts[0]?.id ?? null,
    });
    startupPhase("system prompts restored");
  } catch (error) {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem(SYSTEM_PROMPTS_STORAGE_KEY);
    } catch {
      raw = null;
    }
    if (raw) {
      backupCorruptStorageItem(SYSTEM_PROMPTS_STORAGE_KEY, raw, error);
    }
  }
}

function startSystemPromptPersistence() {
  if (window.__polyuiSystemPromptUnsubscribe) return;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  window.__polyuiSystemPromptUnsubscribe = useModelStore.subscribe(
    (state) => {
      if (timeoutId) clearTimeout(timeoutId);

      timeoutId = setTimeout(() => {
        try {
          localStorage.setItem(
            SYSTEM_PROMPTS_STORAGE_KEY,
            JSON.stringify({
              systemPrompts: state.systemPrompts,
              activeSystemPromptId: state.activeSystemPromptId,
            }),
          );
        } catch {}
      }, 300);
    },
  );
}

async function preloadVisibleAppChunks() {
  startupPhase("preload visible chunks start");
  await Promise.all([
    loadAppModule(),
    import("@/components/Chat/ChatWorkspace"),
    import("@/components/Auth/AuthModal"),
  ]);
  startupPhase("preload visible chunks complete");
}

/*
 * Database architecture:
 * - Frontend conversations/messages: tauri-plugin-sql via repositories/index.ts
 * - Backend users/sessions/provider_configs: sqlx via Rust connection.rs
 * - Both hit the same chat.db file (Windows app_data_dir == app_config_dir).
 * - See connection.rs for backend schema, repositories/index.ts for frontend.
 */
async function initializeStores() {
  startupPhase("initialize stores start");
  restoreSystemPrompts();
  startSystemPromptPersistence();

  startupPhase("notification permission start");
  requestNotificationPermission();

  startupPhase("repository init start");
  const repo = await import("@/lib/repositories");
  await repo.initRepository();
  startupPhase("repository init complete");
  startupPhase("store coordinator init start");
  initStoreCoordinator();
  startupPhase("store coordinator init complete");

  startupPhase("auth restore start");
  await useAuthStore.getState().actions.restoreSession().catch((err) => {
    startupError("Session restore failed", err);
    console.warn("[startup] Session restore failed:", err);
  });
  startupPhase("auth restore complete");

  startupPhase("ollama monitor start");
  useOllamaStore.getState().actions.start();

  startupPhase("update checker init start");
  const { startUpdateChecker } = await import("@/store/updateStore");
  startUpdateChecker();
  startupPhase("update checker init complete");

  startupPhase("idle manager init start");
  const { idleManager, registerDefaultIdleHandlers } = await import("@/lib/idle");
  idleManager.start();
  registerDefaultIdleHandlers();
  startupPhase("idle manager init complete");

  const { isLoading } = useAuthStore.getState();
  if (isLoading) {
    useAuthStore.setState({ isLoading: false });
  }
  startupPhase("initialize stores complete");
}

async function requestNotificationPermission() {
  try {
    if (!(await isPermissionGranted())) {
      await requestPermission();
    }
  } catch {
    startupPhase("notification permission unavailable");
    // Notification permission not available (e.g. non-Tauri or Linux without .desktop file)
  }
}

export async function prepareAppStartup() {
  startupPromise ??= Promise.all([
    preloadVisibleAppChunks(),
    initializeStores(),
  ]).then(() => undefined);

  await startupPromise;
}

declare global {
  interface Window {
    __polyuiSystemPromptUnsubscribe?: () => void;
  }
}

export {};
