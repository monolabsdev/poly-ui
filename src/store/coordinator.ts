import { useAuthStore } from "./authStore";
import { useChatStore } from "./chatStore";
import { useFolderStore } from "./folderStore";
import { useDevStore } from "./devStore";
import { useSettingsStore } from "./settingsStore";
import { setTtsSettings, useTtsStore } from "./ttsStore";
import { setUpdateInstallSimulation } from "./updateStore";
import { getRepository } from "@/lib/repositories";
import { deleteAgentChatSandbox } from "@/features/agent/agentClient";
import { bindViewportOpenRequests, closeViewportForChat } from "@/features/agent/viewportStore";
import { useAgentStore } from "@/features/agent/agentStore";
import { useProviderStore } from "@/features/providers";

// Cross-store effects live here. Stores own local state only.
let initialized = false;
let lastActiveConversationId: string | undefined;
let authTransitionInProgress = false;
const unsubscribeFns: (() => void)[] = [];

type AuthSnapshot = ReturnType<typeof useAuthStore.getState>;

function accountIdFromAuth(state: AuthSnapshot) {
  return state.user?.id || state.guestId || null;
}

async function refreshProviders() {
  await useProviderStore.getState().actions.refresh().catch((err) => {
    console.warn("[coordinator] Provider refresh failed:", err);
  });
}

async function cleanupDeletedConversation(id: string) {
  closeViewportForChat(id);
  await deleteAgentChatSandbox(id).catch((error) => {
    console.warn("Failed to delete agent sandbox:", error);
  });
  useAgentStore.getState().actions.clearWorkspaceSelection(id);
}

export function initStoreCoordinator() {
  if (initialized) return;
  initialized = true;

  // Chat model's show_webpage tool → open the viewport on the active chat.
  void bindViewportOpenRequests(() => useChatStore.getState().activeConversationId)
    .then((unlisten) => unsubscribeFns.push(unlisten))
    .catch(() => undefined);

  const initialAuth = useAuthStore.getState();
  const initialAccountId = accountIdFromAuth(initialAuth);
  useChatStore.getState().actions.setAccountId(initialAccountId);
  useFolderStore.getState().actions.setAccountId(initialAccountId);
  setTtsSettings(useSettingsStore.getState().tts);
  setUpdateInstallSimulation(useDevStore.getState().devMode);

  unsubscribeFns.push(useAuthStore.subscribe((state, prev) => {
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
      if (authTransitionInProgress) return;
      authTransitionInProgress = true;
      const prevGuestId = prev.guestId;
      const newUserId = state.user?.id;
      void (async () => {
        try {
          if (prevGuestId && newUserId) {
            await getRepository()
              .transferConversations(prevGuestId, newUserId)
              .catch((err) => console.warn("[coordinator] Conversation transfer failed:", err));
          }
          await refreshProviders();
          await useChatStore.getState().actions.loadConversations();
          await useFolderStore.getState().actions.loadFolders();
        } finally {
          authTransitionInProgress = false;
        }
      })();
    }
  }));

  unsubscribeFns.push(useChatStore.subscribe((state, prev) => {
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
  }));

  unsubscribeFns.push(useFolderStore.subscribe((state, prev) => {
    if (state.deletedFolderIds === prev.deletedFolderIds || state.deletedFolderIds.length === 0) {
      return;
    }
    useChatStore.getState().actions.clearFolderAssignments(new Set(state.deletedFolderIds));
  }));

  unsubscribeFns.push(useSettingsStore.subscribe((state, prev) => {
    if (state.tts !== prev.tts) {
      setTtsSettings(state.tts);
    }
  }));

  unsubscribeFns.push(useDevStore.subscribe((state, prev) => {
    if (state.devMode !== prev.devMode) {
      setUpdateInstallSimulation(state.devMode);
    }
  }));

  if (initialAccountId) {
    void (async () => {
      await refreshProviders();
      await useChatStore.getState().actions.loadConversations();
      await useFolderStore.getState().actions.loadFolders();
    })();
  }
}

export function cleanupStoreCoordinator() {
  for (const unsub of unsubscribeFns) {
    unsub();
  }
  unsubscribeFns.length = 0;
  initialized = false;
  authTransitionInProgress = false;
  lastActiveConversationId = undefined;
}
