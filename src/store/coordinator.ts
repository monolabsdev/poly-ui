import { useAuthStore } from "./authStore";
import { useChatStore } from "./chatStore";

// One-directional coordinator: auth changes → chat reload.
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
    const userIdChanged = state.user?.id !== prev.user?.id;
    if (becameReady || userIdChanged) {
      useChatStore.getState().actions.loadConversations();
    }
  });
}
