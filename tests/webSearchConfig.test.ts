import { describe, expect, it } from "vitest";
import { getWebSearchProvider, webSearchProviderRegistry } from "../src/features/web-search/registry";

describe("web search config", () => {
  it("bundles a local provider that needs no API key and keeps BYOK providers optional", () => {
    const local = webSearchProviderRegistry.find((provider) => provider.id === "local");

    expect(local?.requiresApiKey).toBe(false);
    expect(webSearchProviderRegistry.some((provider) => provider.requiresApiKey)).toBe(true);
  });

  it("falls back to the local provider for unknown ids", () => {
    expect(getWebSearchProvider("nonsense" as never).id).toBe("local");
  });
});
