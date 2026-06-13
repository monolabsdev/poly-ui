import type { SystemPrompt } from "@/store/modelStore";
import { useAuthStore } from "@/store/authStore";
import { useModelStore } from "@/store/modelStore";
import { useOllamaStore } from "@/services/ollama/monitor";
import { initStoreCoordinator } from "@/store/coordinator";
import { isPermissionGranted, requestPermission } from "@tauri-apps/plugin-notification";

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
  } catch {}
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
  await Promise.all([
    loadAppModule(),
    import("@/components/Chat/ChatWorkspace"),
    import("@/components/Auth/AuthModal"),
  ]);
}

/*
 * Database architecture:
 * - Frontend conversations/messages: tauri-plugin-sql via repositories/index.ts
 * - Backend users/sessions/provider_configs: sqlx via Rust connection.rs
 * - Both hit the same chat.db file (Windows app_data_dir == app_config_dir).
 * - See connection.rs for backend schema, repositories/index.ts for frontend.
 */
async function initializeStores() {
  restoreSystemPrompts();
  startSystemPromptPersistence();

  requestNotificationPermission();

  const repo = await import("@/lib/repositories");
  await repo.initRepository();
  initStoreCoordinator();

  await useAuthStore.getState().actions.restoreSession().catch((err) => {
    console.warn("[startup] Session restore failed:", err);
  });

  useOllamaStore.getState().actions.start();

  const { startUpdateChecker } = await import("@/store/updateStore");
  startUpdateChecker();

  const { isLoading } = useAuthStore.getState();
  if (isLoading) {
    useAuthStore.setState({ isLoading: false });
  }
}

async function requestNotificationPermission() {
  try {
    if (!(await isPermissionGranted())) {
      await requestPermission();
    }
  } catch {
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
