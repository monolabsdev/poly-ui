import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Extraction only runs when BOTH `enabled` and `automatic_extraction` are true
// (see src-tauri/src/memory/service.rs). Any UI path that enables memory must
// enable extraction too, or the feature silently does nothing.
describe("memory beta wiring", () => {
  const tab = readFileSync("src/features/settings/tabs/MemorySettingsTab.tsx", "utf8");
  const advanced = readFileSync("src/features/settings/tabs/AdvancedSettingsContent.tsx", "utf8");
  const extractor = readFileSync("src-tauri/src/memory/extractor.rs", "utf8");

  it("every enable path also turns on automatic extraction", () => {
    expect(tab).toContain("automaticExtraction: true");
    expect(advanced).toContain("automaticExtraction: true");
  });

  it("extraction prompt honors explicit remember requests", () => {
    expect(extractor).toContain("explicitly asks to remember");
  });
});
