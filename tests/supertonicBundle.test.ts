import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Supertonic release bundle", () => {
  it("bundles the generated ONNX Runtime library", () => {
    const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));

    expect(config.bundle.resources).toEqual({
      "target/onnxruntime/*onnxruntime*": "",
    });
  });

  it("builds st-tts before staging its generated runtime", () => {
    const cargo = readFileSync("src-tauri/Cargo.toml", "utf8");
    const buildDependencies = cargo.split("[build-dependencies]")[1].split("\n[")[0];

    expect(buildDependencies).toContain('st-tts = "0.3"');
  });

  it("re-downloads the ONNX runtime when rust-cache pruned it", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

    expect(workflow).toContain("if [ ! -f src-tauri/target/debug/libonnxruntime.so ]; then");
    expect(workflow).toContain("cargo clean --manifest-path src-tauri/Cargo.toml -p st-tts");
  });

  it("runs frontend tests through the Vitest package script", () => {
    const workflow = readFileSync(".github/workflows/ci.yml", "utf8");

    expect(workflow).toContain("run: bun run test");
    expect(workflow).not.toContain("run: bun test");
  });
});
