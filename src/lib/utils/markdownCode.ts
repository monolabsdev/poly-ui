export function isInlineMarkdownCode(className: string | undefined, children: unknown) {
  return !className && !String(children).endsWith("\n");
}
