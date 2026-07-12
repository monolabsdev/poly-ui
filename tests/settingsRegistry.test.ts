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
      "mobile",
      "chat",
      "voice",
      "memory",
      "personalization",
      "data-controls",
      "about",
    ]);
  });

  it("maps legacy tab names from existing callers", () => {
    expect(resolveSettingsTab("connections")).toBe("providers");
    expect(resolveSettingsTab("profile")).toBe("personalization");
    expect(resolveSettingsTab("personalisation")).toBe("chat");
    expect(resolveSettingsTab("speech")).toBe("voice");
    expect(resolveSettingsTab("audio")).toBe("voice");
    expect(resolveSettingsTab("advanced")).toBe("general");
    expect(resolveSettingsTab()).toBe("general");
  });

  it("filters tabs by labels descriptions and keywords", () => {
    expect(filterSettingsTabs("ollama").map((tab) => tab.id)).toEqual(["providers"]);
    expect(filterSettingsTabs("ios").map((tab) => tab.id)).toEqual(["mobile"]);
    expect(filterSettingsTabs("wifi").map((tab) => tab.id)).toEqual(["mobile"]);
    expect(filterSettingsTabs("whisper").map((tab) => tab.id)).toEqual(["voice"]);
    expect(filterSettingsTabs("prompt").map((tab) => tab.id)).toEqual(["chat"]);
    expect(filterSettingsTabs("")).toHaveLength(SETTINGS_TABS.length);
  });

  it("settings shell uses semantic Tailwind tokens only", () => {
    const shell = readFileSync("src/features/settings/SettingsShell.tsx", "utf8");
    expect(shell).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|rgba\(/);
    expect(shell).not.toMatch(/\bspace-[xy]-/);
  });

  it("settings modal delegates advanced instead of rendering an advanced tab", () => {
    const modal = readFileSync("src/features/settings/SettingsModal.tsx", "utf8");
    expect(modal).toContain("onOpenAdvancedSettings");
    expect(modal).not.toContain("<AdvancedTab");
    expect(modal).not.toContain("<DeveloperTab");
  });

  it("advanced settings view registers with view-registry", () => {
    const view = readFileSync("src/features/settings/AdvancedSettingsComposerView.tsx", "utf8");
    expect(view).toContain("registerView(ADVANCED_SETTINGS_VIEW_ID, AdvancedSettingsComposerView)");
    expect(view).toContain("setActiveView(null)");
  });

  it("settings feature avoids raw colors and space utilities", () => {
    const files = [
      "src/features/settings/tabs/PersonalisationTab.tsx",
      "src/features/settings/tabs/ProfileTab.tsx",
      "src/features/settings/tabs/SpeechTab.tsx",
      "src/features/settings/tabs/ConnectionsTab.tsx",
      "src/features/settings/tabs/MemorySettingsTab.tsx",
      "src/features/web-search/WebSearchSettings.tsx",
      "src/features/memory/MemoryTab.tsx",
    ];
    for (const file of files) {
      const source = readFileSync(file, "utf8");
      expect(source, file).not.toMatch(/#[0-9a-fA-F]{3,8}|rgb\(|rgba\(/);
      expect(source, file).not.toMatch(/\bspace-[xy]-/);
    }
  });

  it("command palette opens advanced settings through the view registry", () => {
    const commands = readFileSync("src/features/command-palette/settingsRegistry.tsx", "utf8");
    expect(commands).toContain("openAdvancedSettings");
    expect(commands).toContain("settings-advanced");
    expect(commands).not.toContain('tab: "advanced"');
  });

  it("mobile pairing stays behind experimental features and its own toggle", () => {
    const store = readFileSync("src/store/settingsStore.ts", "utf8");
    const mobileTab = readFileSync("src/features/settings/tabs/MobileTab.tsx", "utf8");
    expect(store).toContain("mobileWebAccess: false");
    expect(mobileTab).toContain("experimentalFeatures");
    expect(mobileTab).toContain("mobileWebAccess");
    expect(mobileTab).toContain("mobile_pairing_stop");
  });
});
