import { getMarkdownRenderBlocks } from "../src/lib/chat/markdownRenderBlocks";

describe("markdown render blocks", () => {
  it("keeps streaming content in one block so token updates skip full block lexing", () => {
    const content = "# Title\n\nFirst paragraph\n\nSecond paragraph";

    expect(getMarkdownRenderBlocks(content, true)).toEqual([content]);
  });

  it("splits completed content into stable blocks for memoized markdown rendering", () => {
    const content = "# Title\n\nFirst paragraph\n\n```ts\nconst x = 1;\n```";

    expect(getMarkdownRenderBlocks(content, false)).toEqual([
      "# Title",
      "\n\n",
      "First paragraph",
      "\n\n",
      "```ts\nconst x = 1;\n```",
    ]);
  });
});
