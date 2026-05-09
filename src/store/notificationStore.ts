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
  actions: {
    add: (toast: Omit<Toast, "id">) => string;
    remove: (id: string) => void;
    update: (id: string, updates: Partial<Toast>) => void;
    clear: () => void;
  };
}

export const useNotificationStore = create<NotificationState>((set) => ({
  toasts: [],
  actions: {
    add: (toast) => {
      const id = crypto.randomUUID();
      set((state) => ({
        toasts: [...state.toasts, { ...toast, id }].slice(-5), // Max 5 toasts
      }));
      return id;
    },
    remove: (id) => {
      set((state) => ({
        toasts: state.toasts.filter((t) => t.id !== id),
      }));
    },
    update: (id, updates) => {
      set((state) => ({
        toasts: state.toasts.map((t) => (t.id === id ? { ...t, ...updates } : t)),
      }));
    },
    clear: () => set({ toasts: [] }),
  },
}));
