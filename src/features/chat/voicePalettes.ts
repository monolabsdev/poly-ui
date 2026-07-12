import type { HeroOrbPalette, HeroOrbState, RGB } from "./components/HeroOrb";

type VoicePalette = {
  colors: [RGB, RGB, RGB];
  glowColor: RGB;
};

const VOICE_PALETTES: Record<string, VoicePalette> = {
  M1: { colors: [[0.04, 0.12, 0.42], [0.18, 0.42, 0.95], [0.86, 0.91, 1]], glowColor: [0.62, 0.75, 1] },
  F1: { colors: [[0.22, 0.06, 0.5], [0.55, 0.25, 0.98], [0.95, 0.87, 1]], glowColor: [0.82, 0.68, 1] },
  M2: { colors: [[0.03, 0.24, 0.16], [0.08, 0.58, 0.36], [0.85, 1, 0.92]], glowColor: [0.52, 0.9, 0.68] },
  F2: { colors: [[0.38, 0.08, 0.26], [0.92, 0.32, 0.63], [1, 0.88, 0.95]], glowColor: [1, 0.66, 0.84] },
  M3: { colors: [[0.42, 0.16, 0.02], [0.94, 0.46, 0.08], [1, 0.94, 0.82]], glowColor: [1, 0.7, 0.34] },
  F3: { colors: [[0.02, 0.25, 0.36], [0.05, 0.68, 0.82], [0.85, 0.98, 1]], glowColor: [0.48, 0.88, 1] },
  M4: { colors: [[0.02, 0.26, 0.25], [0.04, 0.62, 0.58], [0.84, 1, 0.97]], glowColor: [0.44, 0.9, 0.85] },
  F4: { colors: [[0.22, 0.14, 0.42], [0.55, 0.44, 0.82], [0.94, 0.91, 1]], glowColor: [0.78, 0.7, 1] },
  M5: { colors: [[0.08, 0.09, 0.38], [0.26, 0.3, 0.82], [0.88, 0.9, 1]], glowColor: [0.58, 0.62, 1] },
  F5: { colors: [[0.38, 0.26, 0.02], [0.9, 0.68, 0.08], [1, 0.96, 0.82]], glowColor: [1, 0.84, 0.38] },
};

const STATE_TUNING: Partial<Record<HeroOrbState, Pick<HeroOrbPalette, "speed" | "glowStrength">>> = {
  idle: { speed: 42, glowStrength: 0.9 },
  searching: { speed: 58, glowStrength: 1.05 },
  found: { speed: 48, glowStrength: 1.1 },
  connecting: { speed: 54, glowStrength: 1.05 },
  preparing: { speed: 52, glowStrength: 1.1 },
  live: { speed: 65, glowStrength: 1.25 },
};

export function getVoiceOrbPalette(
  voiceName: string,
  state: HeroOrbState,
  enabled: boolean,
): Partial<HeroOrbPalette> | undefined {
  if (!enabled || state === "error" || state === "warning" || state === "unavailable") return undefined;
  const palette = VOICE_PALETTES[voiceName];
  if (!palette) return undefined;
  return { ...palette, ...(STATE_TUNING[state] ?? STATE_TUNING.idle) };
}
