import type { OllamaModel, SystemPrompt } from "@/store/modelStore";
import { useAuthStore } from "@/store/authStore";
import { useChatStore } from "@/store/chatStore";
import { useModelStore } from "@/store/modelStore";
import { useSettingsStore } from "@/store/settingsStore";
import { useToolStore } from "@/store/toolStore";
import { loggedInvoke } from "@/lib/utils";

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

function yieldToMain() {
  const scheduler = (
    window as Window & {
      scheduler?: { yield?: () => Promise<void> };
    }
  ).scheduler;

  if (scheduler?.yield) {
    return scheduler.yield();
  }

  return new Promise<void>((resolve) => window.setTimeout(resolve, 0));
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

async function loadOllamaModels() {
  const {
    setAvailableModels,
    setSelectedModel,
    setIsLoading,
    setOllamaError,
  } = useModelStore.getState();

  setIsLoading(true);
  setOllamaError(null);

  try {
    const models = await loggedInvoke<OllamaModel[]>("get_local_models");
    const { selectedModel, defaultModel } = useModelStore.getState();

    setAvailableModels({ ollama: models });

    if (!selectedModel && models.length > 0) {
      const modelNames = models.map((model) => model.name);
      const preferredModel =
        defaultModel && modelNames.includes(defaultModel)
          ? defaultModel
          : modelNames[0];
      setSelectedModel("ollama", preferredModel);
    }
  } catch (error) {
    console.error("Failed to load Ollama models:", error);
    setOllamaError("Ollama unavailable");
  } finally {
    setIsLoading(false);
  }
}

function startSystemPromptPersistence() {
  const existing = window.__openbenchSystemPromptUnsubscribe;
  if (existing) return;

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  window.__openbenchSystemPromptUnsubscribe = useModelStore.subscribe((state) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

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
  });
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
  restoreSystemPrompts();
  startSystemPromptPersistence();

  await yieldToMain();

  const db = await import("@/lib/db");
  await db.initDB().catch(() => {});

  await yieldToMain();

  await Promise.all([
    Promise.race([
      useSettingsStore.getState().actions.syncToBackend(),
      delay(3000).then(() => {
        throw new Error("Timeout syncing settings");
      }),
    ]).catch(() => {}),
    useAuthStore.getState().actions.restoreSession().catch(() => {}),
    useChatStore.getState().actions.loadConversations().catch(() => {}),
    useToolStore.getState().actions.loadTools().catch(() => {}),
    loadOllamaModels(),
  ]);

  const { isLoading } = useAuthStore.getState();
  if (isLoading) {
    useAuthStore.setState({ isLoading: false });
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
    __openbenchSystemPromptUnsubscribe?: () => void;
  }
}
