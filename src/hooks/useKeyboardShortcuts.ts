import { useEffect } from "react";
import type { SettingsTab } from "@/features/settings/SettingsModal";

export function useKeyboardShortcuts({
  onOpenSettings,
  isAuthGateOpen,
  setIsCommandPaletteOpen,
}: {
  onOpenSettings: (tab: SettingsTab) => void;
  isAuthGateOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === ",") {
        event.preventDefault();
        onOpenSettings("general");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onOpenSettings]);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        if (event.repeat) return;
        if (isAuthGateOpen) {
          setIsCommandPaletteOpen(false);
          return;
        }
        setIsCommandPaletteOpen((open) => !open);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isAuthGateOpen, setIsCommandPaletteOpen]);
}
