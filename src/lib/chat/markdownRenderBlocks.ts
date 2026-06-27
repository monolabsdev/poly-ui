import { marked } from "marked";

export function getMarkdownRenderBlocks(markdown: string, streaming: boolean): string[] {
  if (streaming) return markdown ? [markdown] : [];
  const tokens = marked.lexer(markdown);
  return tokens.map((token) => token.raw);
}
