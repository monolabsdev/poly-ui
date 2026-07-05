import { resolveBrowserInput } from "../src/features/agent/browserNavigation";

describe("browser navigation input", () => {
  it("keeps full http urls", () => {
    expect(resolveBrowserInput("https://example.com/docs")).toBe("https://example.com/docs");
  });

  it("opens domains as pages", () => {
    expect(resolveBrowserInput("example.com/docs")).toBe("https://example.com/docs");
  });

  it("uses http for local dev addresses", () => {
    expect(resolveBrowserInput("127.0.0.1:5173")).toBe("http://127.0.0.1:5173");
    expect(resolveBrowserInput("localhost:4173/demo")).toBe("http://localhost:4173/demo");
  });

  it("uses Google for plain searches", () => {
    expect(resolveBrowserInput("pricing page inspiration")).toBe(
      "https://www.google.com/search?q=pricing+page+inspiration",
    );
  });

  it("ignores blank input", () => {
    expect(resolveBrowserInput("  ")).toBeNull();
  });
});
