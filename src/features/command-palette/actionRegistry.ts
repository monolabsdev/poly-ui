import { useSyncExternalStore } from "react";
import type { CommandPaletteItem } from "./types";

export type CommandPaletteActionContribution = Omit<
  CommandPaletteItem,
  "category"
> & {
  category?: "action";
};

const actionContributions = new Map<string, CommandPaletteActionContribution>();
const listeners = new Set<() => void>();
let cachedSnapshot: CommandPaletteItem[] = [];

function rebuildSnapshot() {
  cachedSnapshot = Array.from(actionContributions.values()).map((action) => ({
    ...action,
    category: "action" as const,
  }));
}

function emitChange() {
  rebuildSnapshot();
  listeners.forEach((listener) => listener());
}

export function registerCommandPaletteAction(
  action: CommandPaletteActionContribution,
) {
  actionContributions.set(action.id, action);
  emitChange();
  return () => {
    actionContributions.delete(action.id);
    emitChange();
  };
}

function getSnapshot() {
  return cachedSnapshot;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRegisteredCommandPaletteActions(): CommandPaletteItem[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
