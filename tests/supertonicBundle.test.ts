import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Supertonic release bundle", () => {
  it("bundles the generated ONNX Runtime library", () => {
    const config = JSON.parse(readFileSync("src-tauri/tauri.conf.json", "utf8"));

    expect(config.bundle.resources).toEqual({
      "target/onnxruntime/*onnxruntime*": "",
    });
  });
});
