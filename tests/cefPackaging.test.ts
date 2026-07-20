import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const buildScript = readFileSync(new URL("../src-tauri/build.rs", import.meta.url), "utf8");
const appBackend = readFileSync(new URL("../src-tauri/src/lib.rs", import.meta.url), "utf8");
const startup = readFileSync(new URL("../src/startup.ts", import.meta.url), "utf8");
const linuxBundleConfig = JSON.parse(
  readFileSync(new URL("../src-tauri/tauri.linux.conf.json", import.meta.url), "utf8"),
);

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

  it("ships the CEF runtime beside libcef.so in every Linux package", () => {
    // libcef.so is a hard DT_NEEDED dependency of the binary and CEF resolves
    // icudtl.dat/pak files/locales from the directory containing libcef.so,
    // so every bundle format must carry the full runtime in /usr/lib/PolyUI.
    const requiredFiles = [
      "/usr/lib/PolyUI/libcef.so",
      "/usr/lib/PolyUI/icudtl.dat",
      "/usr/lib/PolyUI/resources.pak",
      "/usr/lib/PolyUI/chrome_100_percent.pak",
      "/usr/lib/PolyUI/chrome_200_percent.pak",
      "/usr/lib/PolyUI/v8_context_snapshot.bin",
      "/usr/lib/PolyUI/locales/en-US.pak",
    ];
    for (const format of ["deb", "rpm", "appimage"]) {
      const files = linuxBundleConfig.bundle.linux[format].files;
      for (const required of requiredFiles) {
        expect(files[required], `${format} is missing ${required}`).toBeDefined();
      }
    }
  });

  it("resolves libcef.so from the installed usr/lib/PolyUI layout", () => {
    expect(buildScript).toContain("$ORIGIN:$ORIGIN/../lib/PolyUI");
  });

  it("initializes CEF only when its Linux boot preference is enabled", () => {
    expect(appBackend).toContain("cef_osr::enabled_on_next_start()");
    expect(appBackend).toContain("tauri::process::restart");
    expect(startup).toContain("cefViewportIsEnabled");
  });
});
