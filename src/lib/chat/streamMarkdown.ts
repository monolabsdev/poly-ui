export type ProgressiveMarkdown = {
  safe: string;
  pending: boolean;
  pendingCode?: {
    language: string | null;
    code: string;
  };
};

function escapeMarkdown(text: string) {
  return text.replace(/([\\`*_[\]()#+\-.!])/g, "\\$1");
}

function escapeTrailingLineBlock(text: string): { text: string; pending: boolean } {
  const lineStart = text.lastIndexOf("\n") + 1;
  const trailingLine = text.slice(lineStart);
  if (!/^(?:#{1,6}\s|[-+*]\s|\d+\.\s)/.test(trailingLine)) {
    return { text, pending: false };
  }

  return {
    text: text.slice(0, lineStart) + trailingLine.replace(
      /^([#\-+*]|\d+\.)/,
      (marker) => /^\d/.test(marker) ? `${marker.slice(0, -1)}\\.` : `\\${marker}`,
    ),
    pending: true,
  };
}

function escapeIncompleteInline(text: string): { text: string; pending: boolean } {
  let pending = false;
  let safe = text;

  safe = safe.replace(/\[[^\]]*\]\([^)]*$/g, (match) => {
    pending = true;
    return escapeMarkdown(match);
  });

  const backticks = safe.match(/(?<!\\)`/g)?.length ?? 0;
  if (backticks % 2 === 1) {
    pending = true;
    safe = safe.replace(/(?<!\\)`(?=[^`]*$)/, "\\`");
  }

  const visibleSyntax = safe.replace(/(?<!\\)`[^`\n]*`/g, (match) => " ".repeat(match.length));
  const boldMarkers = visibleSyntax.match(/(?<!\\)\*\*/g)?.length ?? 0;
  if (boldMarkers % 2 === 1) {
    pending = true;
    safe = safe.replace(/(?<!\\)\*\*(?![\s\S]*\*\*)/, "\\*\\*");
  }

  const italicMarkers = visibleSyntax.match(/(?<![\\*])\*(?!\*)/g)?.length ?? 0;
  if (italicMarkers % 2 === 1) {
    pending = true;
    safe = safe.replace(/(?<![\\*])\*(?!\*)(?![\s\S]*\*)/, "\\*");
  }

  return { text: safe, pending };
}

export function parseProgressive(text: string): ProgressiveMarkdown {
  const fences = [...text.matchAll(/^```([^\n`]*)\n?/gm)];
  if (fences.length % 2 === 1) {
    const opening = fences[fences.length - 1];
    const fenceStart = opening.index ?? 0;
    const language = opening[1].trim() || null;
    const codeStart = fenceStart + opening[0].length;
    const safePrefix = escapeIncompleteInline(text.slice(0, fenceStart));
    return {
      safe: safePrefix.text,
      pending: true,
      pendingCode: { language, code: text.slice(codeStart) },
    };
  }

  const segments = text.split(/(^```[^\n`]*\n[\s\S]*?^```[^\n]*$)/gm);
  let pending = false;
  const safe = segments.map((segment, index) => {
    if (index % 2 === 1) return segment;
    const lineBlock = segment.endsWith("\n")
      ? { text: segment, pending: false }
      : escapeTrailingLineBlock(segment);
    const inline = escapeIncompleteInline(lineBlock.text);
    pending ||= lineBlock.pending || inline.pending;
    return inline.text;
  }).join("");
  return {
    safe,
    pending,
  };
}
