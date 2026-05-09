import type { SystemPrompt } from "@/store/modelStore";
import { useAuthStore } from "@/store/authStore";
import { useChatStore } from "@/store/chatStore";
import { useModelStore } from "@/store/modelStore";
import { useToolStore } from "@/store/toolStore";
import { useOllamaStore } from "@/services/ollama/monitor";
import { useProviderStore } from "@/services/providers";

const SYSTEM_PROMPTS_STORAGE_KEY = "openbench.systemPrompts";

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

export function delay(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
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
  } catch {
    // Ignore persisted prompt parse errors.
  }
}

// Ollama loading is now handled by the monitor.
function startSystemPromptPersistence() {
  if (window.__openbenchSystemPromptUnsubscribe) return;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  window.__openbenchSystemPromptUnsubscribe = useModelStore.subscribe(
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
        } catch {
          // Ignore storage failures.
        }
      }, 300);
    },
  );
}

async function preloadVisibleAppChunks() {
  await Promise.all([
    loadAppModule(),
    import("@/components/Chat/ChatWorkspace"),
    import("@/components/Auth/AuthModal"),
    import("@/components/Chat/ToolApproval"),
  ]);
}

async function initializeStores() {
  console.log("[Startup] Initializing stores...");
  restoreSystemPrompts();
  startSystemPromptPersistence();

  const db = await import("@/lib/db");
  await db.initDB().catch(() => {});

  await Promise.all([
    useProviderStore.getState().actions.refresh().then(() => console.log("[Startup] Providers refreshed:", useProviderStore.getState().providers)).catch(err => console.error("[Startup] Provider refresh failed:", err)),
    useAuthStore.getState().actions.restoreSession().catch(() => {}),
    useChatStore.getState().actions.loadConversations().catch(() => {}),
    useToolStore.getState().actions.loadTools().catch(() => {}),
  ]).catch(() => {});

  useOllamaStore.getState().actions.start();

  const { isLoading } = useAuthStore.getState();
  if (isLoading) {
    useAuthStore.setState({ isLoading: false });
  }
}

export async function prepareAppStartup() {
  console.log("[Startup] localStorage settings:", localStorage.getItem("settings-storage"));
  startupPromise ??= Promise.all([
    preloadVisibleAppChunks(),
    initializeStores(),
  ]).then(() => undefined);

  await startupPromise;
}

declare global {
  interface Window {
    __openbenchSystemPromptUnsubscribe?: () => void;
  }
}
