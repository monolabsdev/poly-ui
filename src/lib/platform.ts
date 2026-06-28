const platform = typeof navigator === "undefined" ? "" : navigator.platform;

export const IS_MAC = platform.includes("Mac");
export const MOD_KEY = IS_MAC ? "⌘" : "Ctrl";
export const MOD_PROP: "meta" | "ctrl" = IS_MAC ? "meta" : "ctrl";
export const ALT_KEY = IS_MAC ? "⌥" : "Alt";
export const SHIFT_KEY = IS_MAC ? "⇧" : "Shift";
export const KEY_SEP = IS_MAC ? "" : "+";

export function fmtShortcut(...parts: string[]): string {
  return parts.join(KEY_SEP);
}
