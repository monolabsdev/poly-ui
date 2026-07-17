import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const buildScript = readFileSync(new URL("../src-tauri/build.rs", import.meta.url), "utf8");

describe("CEF packaging", () => {
  it("strips CEF symbols only from Linux release builds", () => {
    expect(buildScript).toContain('profile != "release" || !target.contains("linux")');
    expect(buildScript).toContain('Command::new("strip")');
    expect(buildScript).toContain('"--strip-unneeded"');
  });

  it("keeps only runtime files needed by the configured locale", () => {
    expect(buildScript).toContain('RETAINED_CEF_LOCALE: &str = "en-US.pak"');
    expect(buildScript).toContain('"CREDITS.html"');
    expect(buildScript).toContain("remove_file");
  });
});
