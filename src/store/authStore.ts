import { create } from "zustand";
import { User, AuthResponse } from "@/types/auth";
import { loggedInvoke } from "@/lib/utils";
import { useChatStore } from "@/store/chatStore";
import { getRepository } from "@/lib/repositories";

const GUEST_ID_KEY = "openbench.guestId";
const GUEST_WARNING_KEY = "openbench.guestWarningDismissed";

function loadGuestId(): string | null {
  try {
    return localStorage.getItem(GUEST_ID_KEY);
  } catch { return null; }
}

function saveGuestId(id: string | null) {
  try {
    if (id) localStorage.setItem(GUEST_ID_KEY, id);
    else localStorage.removeItem(GUEST_ID_KEY);
  } catch {}
}

function loadGuestWarningDismissed(): boolean {
  try {
    return localStorage.getItem(GUEST_WARNING_KEY) === "true";
  } catch { return false; }
}

function saveGuestWarningDismissed(v: boolean) {
  try {
    if (v) localStorage.setItem(GUEST_WARNING_KEY, "true");
    else localStorage.removeItem(GUEST_WARNING_KEY);
  } catch {}
}

type AuthStore = {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  isGuest: boolean;
  guestId: string | null;
  guestWarningDismissed: boolean;
  actions: {
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string, fullName?: string) => Promise<void>;
    logout: () => Promise<void>;
    updateStatus: (status: string) => Promise<void>;
    restoreSession: () => Promise<void>;
    clearError: () => void;
    skipAuth: () => void;
    dismissGuestWarning: () => void;
    openAuth: () => void;
  };
};

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  isGuest: false,
  guestId: loadGuestId(),
  guestWarningDismissed: loadGuestWarningDismissed(),

  actions: {
    skipAuth: () => {
      const id = get().guestId || crypto.randomUUID();
      saveGuestId(id);
      set({ isGuest: true, guestId: id, isLoading: false });
      useChatStore.getState().actions.loadConversations();
    },

    dismissGuestWarning: () => {
      saveGuestWarningDismissed(true);
      set({ guestWarningDismissed: true });
    },

    login: async (email, password) => {
      set({ isLoading: true, error: null });
      try {
        const response = await loggedInvoke<AuthResponse>("auth_login", { email, password });
        localStorage.setItem("session_token", response.token);

        const { guestId } = get();
        if (guestId) {
          try {
            const repo = getRepository();
            await repo.transferConversations(guestId, response.user.id);
          } catch {}
          saveGuestId(null);
        }

        set({ user: response.user, isAuthenticated: true, isGuest: false, guestId: null, isLoading: false, guestWarningDismissed: true });
        await useChatStore.getState().actions.loadConversations();
      } catch (err) {
        set({ error: err as string, isLoading: false });
        throw err;
      }
    },
    signup: async (email, password, fullName) => {
      set({ isLoading: true, error: null });
      try {
        const response = await loggedInvoke<AuthResponse>("auth_signup", { email, password, fullName });
        localStorage.setItem("session_token", response.token);

        const { guestId } = get();
        if (guestId) {
          try {
            const repo = getRepository();
            await repo.transferConversations(guestId, response.user.id);
          } catch {}
          saveGuestId(null);
        }

        set({ user: response.user, isAuthenticated: true, isGuest: false, guestId: null, isLoading: false, guestWarningDismissed: true });
        await useChatStore.getState().actions.loadConversations();
      } catch (err) {
        set({ error: err as string, isLoading: false });
        throw err;
      }
    },
    logout: async () => {
      set({ isLoading: true });
      try {
        const token = localStorage.getItem("session_token");
        if (token) {
          await loggedInvoke("auth_logout", { token });
        }
        localStorage.removeItem("session_token");
        set({ user: null, isAuthenticated: false, isLoading: false });
        await useChatStore.getState().actions.loadConversations();
      } catch (err) {
        console.error("Logout error:", err);
        localStorage.removeItem("session_token");
        set({ user: null, isAuthenticated: false, isLoading: false });
        await useChatStore.getState().actions.loadConversations();
      }
    },
    updateStatus: async (status) => {
      const token = localStorage.getItem("session_token");
      if (!token) return;
      try {
        await loggedInvoke("auth_update_status", { token, status });
        set((state) => ({
          user: state.user ? { ...state.user, status } : null,
        }));
      } catch (err) {
        set({ error: err as string });
      }
    },
    restoreSession: async () => {
      const token = localStorage.getItem("session_token");
      if (!token) {
        set({ isLoading: false });
        return;
      }
      set({ isLoading: true });
      try {
        const user = await loggedInvoke<User>("auth_get_current_user", { token });
        set({ user, isAuthenticated: true, isLoading: false, guestWarningDismissed: true });
      } catch {
        localStorage.removeItem("session_token");
        set({ user: null, isAuthenticated: false, isLoading: false });
      }
    },
    openAuth: () => {
      set({ isGuest: false, error: null });
    },
    clearError: () => set({ error: null }),
  },
}));
