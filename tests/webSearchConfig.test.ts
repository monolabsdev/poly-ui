import { readFileSync } from "node:fs";

describe("web search config", () => {
  it("defaults to bundled local provider and keeps BYOK providers optional", () => {
    const settings = readFileSync("src/store/settingsStore.ts", "utf8");
    const registry = readFileSync("src/features/web-search/registry.ts", "utf8");

    expect(settings).toContain('provider: "local"');
    expect(registry).toContain('id: "local"');
    expect(registry).toContain("requiresApiKey: false");
    expect(registry).toContain("requiresApiKey: true");
  });
});
