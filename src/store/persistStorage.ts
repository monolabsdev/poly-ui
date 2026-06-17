import type { PersistStorage, StorageValue } from "zustand/middleware";
import { backupCorruptStorageItem, startupPhase } from "@/lib/utils/startupDiagnostics";

function isStorageValue<S>(value: unknown): value is StorageValue<S> {
  return Boolean(value && typeof value === "object" && "state" in value);
}

export function createSafeJsonStorage<S>(): PersistStorage<S> {
  return {
    getItem: (name) => {
      startupPhase(`persisted store hydrate start: ${name}`);
      const raw = localStorage.getItem(name);
      if (!raw) {
        startupPhase(`persisted store empty: ${name}`);
        return null;
      }

      try {
        const parsed = JSON.parse(raw);
        if (!isStorageValue<S>(parsed)) {
          throw new Error("Persisted value missing state envelope");
        }
        startupPhase(`persisted store hydrate complete: ${name}`);
        return parsed;
      } catch (error) {
        backupCorruptStorageItem(name, raw, error);
        return null;
      }
    },
    setItem: (name, value) => {
      localStorage.setItem(name, JSON.stringify(value));
    },
    removeItem: (name) => {
      localStorage.removeItem(name);
    },
  };
}
