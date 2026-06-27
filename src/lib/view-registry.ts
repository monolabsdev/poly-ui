import { create } from "zustand";
import type { ComponentType } from "react";

type ViewComponent = ComponentType<Record<string, never>>;

const views = new Map<string, ViewComponent>();

export function registerView(id: string, component: ViewComponent) {
  if (views.has(id)) {
    console.warn(`[view-registry] View "${id}" already registered — overwriting`);
  }
  views.set(id, component);
}

export function getViewComponent(id: string): ViewComponent | undefined {
  return views.get(id);
}

export function getRegisteredViews(): string[] {
  return [...views.keys()];
}

interface ViewState {
  activeView: string | null;
  setActiveView: (id: string | null) => void;
}

export const useViewStore = create<ViewState>((set) => ({
  activeView: null,
  setActiveView: (id) => set({ activeView: id }),
}));
