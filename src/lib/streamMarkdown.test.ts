import { describe, expect, test } from "bun:test";
import { parseProgressive } from "./streamMarkdown";

describe("parseProgressive", () => {
  test("keeps complete inline markdown and escapes incomplete syntax", () => {
    expect(parseProgressive("**bold** *italic* `code` [link](https://x.test)")).toEqual({
      safe: "**bold** *italic* `code` [link](https://x.test)",
      pending: false,
    });
    expect(parseProgressive("**bold")).toEqual({ safe: "\\*\\*bold", pending: true });
    expect(parseProgressive("*italic")).toEqual({ safe: "\\*italic", pending: true });
    expect(parseProgressive("`code")).toEqual({ safe: "\\`code", pending: true });
    expect(parseProgressive("[link](https://x.test")).toEqual({
      safe: "\\[link\\]\\(https://x\\.test",
      pending: true,
    });
  });

  test("returns trailing open code fence as partial code", () => {
    expect(parseProgressive("Before\n\n```ts\nconst x = 1;")).toEqual({
      safe: "Before\n\n",
      pending: true,
      pendingCode: { language: "ts", code: "const x = 1;" },
    });
  });

  test("keeps completed code fences as markdown", () => {
    const text = "```ts\nconst x = 1;\n```";
    expect(parseProgressive(text)).toEqual({ safe: text, pending: false });
  });

  test("waits for newline before rendering trailing header or list item", () => {
    expect(parseProgressive("# Header")).toEqual({ safe: "\\# Header", pending: true });
    expect(parseProgressive("- item")).toEqual({ safe: "\\- item", pending: true });
    expect(parseProgressive("1. item")).toEqual({ safe: "1\\. item", pending: true });
    expect(parseProgressive("# Header\n- item\n1. item\n")).toEqual({
      safe: "# Header\n- item\n1. item\n",
      pending: false,
    });
  });

  test("supports consecutive emphasis markers", () => {
    expect(parseProgressive("**one****two**")).toEqual({
      safe: "**one****two**",
      pending: false,
    });
  });

  test("does not treat spaced operator symbols as italic markers", () => {
    const text = "It can do the four basic operations (`+`, `-`, `*`, `/`).";
    expect(parseProgressive(text)).toEqual({ safe: text, pending: false });
  });
});
