import { invoke } from "@tauri-apps/api/core";
import { defaultPerformance, type PerformanceSettings, type SystemProfile } from "@/store/settingsStore";

export async function readSystemProfile(): Promise<SystemProfile> {
  try {
    return await invoke<SystemProfile>("get_system_profile");
  } catch {
    return {
      totalMemoryMb: 0,
      availableMemoryMb: 0,
      cpuCount: navigator.hardwareConcurrency || 1,
    };
  }
}

export function choosePerformanceSettings(
  system: SystemProfile,
  prefersReducedMotion: boolean,
): Partial<PerformanceSettings> {
  const ram = system.totalMemoryMb;
  const cpu = system.cpuCount;
  const isLow = (ram > 0 && ram <= 8192) || cpu <= 4;
  const isHigh = (ram >= 16384 && cpu >= 8);

  if (isLow) {
    return {
      profile: "low",
      reduceMotion: true,
      reduceTransparency: true,
      lastHardwareScan: system,
      optimizedAt: new Date().toISOString(),
    };
  }

  if (isHigh) {
    return {
      profile: "high",
      reduceMotion: prefersReducedMotion,
      reduceTransparency: false,
      lastHardwareScan: system,
      optimizedAt: new Date().toISOString(),
    };
  }

  return {
    ...defaultPerformance,
    profile: "balanced",
    reduceMotion: prefersReducedMotion,
    reduceTransparency: true,
    lastHardwareScan: system,
    optimizedAt: new Date().toISOString(),
  };
}
