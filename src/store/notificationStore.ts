import { create } from "zustand";

export type ToastType = "success" | "error" | "warning" | "info" | "loading";

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  description?: string;
  duration?: number; // ms
  action?: {
    label: string;
    onClick: () => void;
  };
}

interface NotificationState {
  toasts: Toast[];
  removing: Set<string>;
  actions: {
    add: (toast: Omit<Toast, "id">) => string;
    startRemove: (id: string) => void;
    remove: (id: string) => void;
    update: (id: string, updates: Partial<Toast>) => void;
    clear: () => void;
  };
}

export const useNotificationStore = create<NotificationState>((set) => ({
  toasts: [],
  removing: new Set(),
  actions: {
    add: (toast) => {
      const id = crypto.randomUUID();
      set((state) => ({
        toasts: [...state.toasts, { ...toast, id }].slice(-5), // Max 5 toasts
      }));
      return id;
    },
    startRemove: (id) => {
      set((state) => ({
        removing: new Set(state.removing).add(id),
      }));
    },
    remove: (id) => {
      set((state) => {
        const next = new Set(state.removing);
        next.delete(id);
        return {
          toasts: state.toasts.filter((t) => t.id !== id),
          removing: next,
        };
      });
    },
    update: (id, updates) => {
      set((state) => ({
        toasts: state.toasts.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      }));
    },
    clear: () => set({ toasts: [], removing: new Set() }),
  },
}));
