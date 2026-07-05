import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ADVANCED_SETTINGS_ITEM,
  ADVANCED_SETTINGS_VIEW_ID,
  SETTINGS_TABS,
  filterSettingsTabs,
  resolveSettingsTab,
} from "../src/features/settings/settingsRegistry";

describe("settings registry", () => {
  it("keeps advanced pinned outside normal modal tabs", () => {
    expect(ADVANCED_SETTINGS_VIEW_ID).toBe("advanced-settings");
    expect(ADVANCED_SETTINGS_ITEM.id).toBe("advanced");
    expect(SETTINGS_TABS.map((tab) => tab.id)).not.toContain("advanced");
  });

  it("hides unbacked categories instead of inventing tabs", () => {
    expect(SETTINGS_TABS.map((tab) => tab.id)).toEqual([
      "general",
      "interface",
      "providers",
      "chat",
      "audio",
      "personalization",
      "data-controls",
      "about",
    ]);
  });

  it("maps legacy tab names from existing callers", () => {
    expect(resolveSettingsTab("connections")).toBe("providers");
    expect(resolveSettingsTab("profile")).toBe("personalization");
    expect(resolveSettingsTab("personalisation")).toBe("chat");
    expect(resolveSettingsTab("speech")).toBe("audio");
    expect(resolveSettingsTab("advanced")).toBe("general");
    expect(resolveSettingsTab()).toBe("general");
  });

  it("filters tabs by labels descriptions and keywords", () => {
    expect(filterSettingsTabs("ollama").map((tab) => tab.id)).toEqual(["providers"]);
    expect(filterSettingsTabs("whisper").map((tab) => tab.id)).toEqual(["audio"]);
    expect(filterSettingsTabs("prompt").map((tab) => tab.id)).toEqual(["chat"]);
    expect(filterSettingsTabs("")).toHaveLength(SETTINGS_TABS.length);
  });

  it("settings shell uses semantic Tailwind tokens only", () => {
    const shell = readFileSync("src/features/settings/SettingsShell.tsx", "utf8");
    expect(shell).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|rgba\(/);
    expect(shell).not.toMatch(/\bspace-[xy]-/);
  });
});
