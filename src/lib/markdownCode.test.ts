import { describe, expect, test } from "bun:test";
import { isInlineMarkdownCode } from "./markdownCode";

describe("isInlineMarkdownCode", () => {
  test("recognizes inline operator code spans", () => {
    expect(isInlineMarkdownCode(undefined, "*")).toBe(true);
  });

  test("keeps fenced code blocks as blocks with or without language", () => {
    expect(isInlineMarkdownCode("language-ts", "const x = 1;\n")).toBe(false);
    expect(isInlineMarkdownCode(undefined, "const x = 1;\n")).toBe(false);
  });
});
