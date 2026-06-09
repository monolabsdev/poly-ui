import { useAuthStore } from "./authStore";
import { useChatStore } from "./chatStore";
import { useFolderStore } from "./folderStore";
import { useDevStore } from "./devStore";
import { useSettingsStore } from "./settingsStore";
import { setTtsBrowserSettings, useTtsStore } from "./ttsStore";
import { setUpdateInstallSimulation } from "./updateStore";
import { getRepository } from "@/lib/repositories";
import { deleteAgentChatSandbox } from "@/features/agent/agentClient";
import { useAgentStore } from "@/features/agent/agentStore";

// Cross-store effects live here. Stores own local state only.
let initialized = false;
let lastActiveConversationId: string | undefined;

type AuthSnapshot = ReturnType<typeof useAuthStore.getState>;

function accountIdFromAuth(state: AuthSnapshot) {
  return state.user?.id || state.guestId || null;
}

async function refreshProviders() {
  const { useProviderStore } = await import("@/services/providers");
  await useProviderStore.getState().actions.refresh().catch(() => {});
}

async function cleanupDeletedConversation(id: string) {
  await deleteAgentChatSandbox(id).catch((error) => {
    console.warn("Failed to delete agent sandbox:", error);
  });
  useAgentStore.getState().actions.clearWorkspaceSelection(id);
}

export function initStoreCoordinator() {
  if (initialized) return;
  initialized = true;

  const initialAuth = useAuthStore.getState();
  const initialAccountId = accountIdFromAuth(initialAuth);
  useChatStore.getState().actions.setAccountId(initialAccountId);
  useFolderStore.getState().actions.setAccountId(initialAccountId);
  setTtsBrowserSettings(useSettingsStore.getState().tts.browser);
  setUpdateInstallSimulation(useDevStore.getState().devMode);

  useAuthStore.subscribe((state, prev) => {
    const authId = accountIdFromAuth(state);
    const prevAuthId = accountIdFromAuth(prev);
    const becameReady = authId && !prevAuthId;
    const authIdChanged = authId !== prevAuthId;

    useChatStore.getState().actions.setAccountId(authId);
    useFolderStore.getState().actions.setAccountId(authId);

    if (!authId) {
      useChatStore.setState({
        conversations: [],
        messages: [],
        activeConversationId: null,
        hasMoreMessages: false,
      });
      useFolderStore.setState({ folders: [], activeFolderId: null });
    }

    if (becameReady || authIdChanged) {
      void (async () => {
        if (prev.guestId && state.user?.id) {
          await getRepository()
            .transferConversations(prev.guestId, state.user.id)
            .catch(() => {});
        }
        await refreshProviders();
        await useChatStore.getState().actions.loadConversations();
        await useFolderStore.getState().actions.loadFolders();
      })();
    }
  });

  useChatStore.subscribe((state, prev) => {
    if (state.deletedConversationIds !== prev.deletedConversationIds) {
      state.deletedConversationIds.forEach((id) => {
        void cleanupDeletedConversation(id);
      });
    }

    const currentId = state.activeConversationId;
    if (lastActiveConversationId !== undefined && currentId !== lastActiveConversationId) {
      useTtsStore.getState().actions.stop();
    }
    lastActiveConversationId = currentId ?? undefined;
  });

  useFolderStore.subscribe((state, prev) => {
    if (state.deletedFolderIds === prev.deletedFolderIds || state.deletedFolderIds.length === 0) {
      return;
    }
    useChatStore.getState().actions.clearFolderAssignments(new Set(state.deletedFolderIds));
  });

  useSettingsStore.subscribe((state, prev) => {
    if (state.tts.browser !== prev.tts.browser) {
      setTtsBrowserSettings(state.tts.browser);
    }
  });

  useDevStore.subscribe((state, prev) => {
    if (state.devMode !== prev.devMode) {
      setUpdateInstallSimulation(state.devMode);
    }
  });

  if (initialAccountId) {
    void (async () => {
      await refreshProviders();
      await useChatStore.getState().actions.loadConversations();
      await useFolderStore.getState().actions.loadFolders();
    })();
  }
}
