import { useAuthStore } from "./authStore";
import { useChatStore } from "./chatStore";
import { useFolderStore } from "./folderStore";

// One-directional coordinator: auth changes -> scoped data reload.
// Replaces implicit circular deps (authStore → chatStore, chatStore → authStore)
// with a single, visible subscription.
let initialized = false;

export function initStoreCoordinator() {
  if (initialized) return;
  initialized = true;

  useAuthStore.subscribe((state, prev) => {
    const authId = state.user?.id || state.guestId;
    const prevAuthId = prev.user?.id || prev.guestId;
    const becameReady = authId && !prevAuthId;
    const authIdChanged = authId !== prevAuthId;
    if (!authId) {
      useFolderStore.setState({ folders: [], activeFolderId: null });
    }
    if (becameReady || authIdChanged) {
      useChatStore.getState().actions.loadConversations();
      useFolderStore.getState().actions.loadFolders();
    }
  });
}
