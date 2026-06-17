import { platform } from "@tauri-apps/plugin-os";

const PLATFORM = (() => {
  try { return platform(); } catch { return ""; }
})();

export const IS_MAC = PLATFORM === "macos";
export const IS_LINUX = PLATFORM === "linux";
export const IS_WINDOWS = PLATFORM === "windows";

export const USE_CUSTOM_WINDOW_CONTROLS = IS_WINDOWS;
