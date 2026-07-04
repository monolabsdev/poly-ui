export type DiffLine = {
  id: string;
  kind: "add" | "remove" | "context" | "hunk" | "meta" | "fold";
  text: string;
  oldNumber?: number;
  newNumber?: number;
};

const GIT_METADATA_PREFIXES = [
  "diff --git",
  "index ",
  "--- ",
  "+++ ",
  "new file mode",
  "deleted file mode",
  "old mode",
  "new mode",
  "similarity index",
  "dissimilarity index",
  "rename from",
  "rename to",
  "copy from",
  "copy to",
  "Binary files ",
  "GIT binary patch",
  "literal ",
  "delta ",
  "\\ No newline at end of file",
];

export function parseUnifiedDiff(diff: string): DiffLine[] {
  const lines = diff.split(/\r?\n/);
  let oldNumber = 0;
  let newNumber = 0;

  return lines
    .filter((line, index) => index < lines.length - 1 || line.length > 0)
    .map((text, index) => {
      const hunk = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(text);
      if (hunk) {
        oldNumber = Number(hunk[1]);
        newNumber = Number(hunk[2]);
        return { id: `${index}-hunk`, kind: "hunk", text } satisfies DiffLine;
      }
      if (GIT_METADATA_PREFIXES.some((prefix) => text.startsWith(prefix))) {
        return { id: `${index}-meta`, kind: "meta", text } satisfies DiffLine;
      }
      if (text.startsWith("+")) {
        return { id: `${index}-add`, kind: "add", text, newNumber: newNumber++ } satisfies DiffLine;
      }
      if (text.startsWith("-")) {
        return { id: `${index}-remove`, kind: "remove", text, oldNumber: oldNumber++ } satisfies DiffLine;
      }
      const row = { id: `${index}-context`, kind: "context", text, oldNumber, newNumber } satisfies DiffLine;
      oldNumber += 1;
      newNumber += 1;
      return row;
    });
}

export function collapseContext(lines: DiffLine[]): DiffLine[] {
  const result: DiffLine[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (lines[i].kind !== "context") {
      result.push(lines[i]);
      continue;
    }
    const start = i;
    while (i < lines.length && lines[i].kind === "context") i += 1;
    const group = lines.slice(start, i);
    i -= 1;
    if (group.length <= 8) {
      result.push(...group);
      continue;
    }
    result.push(...group.slice(0, 3));
    result.push({
      id: `${group[0].id}-fold`,
      kind: "fold",
      text: `${group.length - 6} unmodified lines`,
    });
    result.push(...group.slice(-3));
  }
  return result;
}

export function getDiffLanguage(path: string): string | undefined {
  const lower = path.toLowerCase().split(/[?#]/, 1)[0];
  if (lower.endsWith(".tsx")) return "tsx";
  if (lower.endsWith(".ts")) return "ts";
  if (lower.endsWith(".jsx")) return "jsx";
  if (lower.endsWith(".js") || lower.endsWith(".mjs") || lower.endsWith(".cjs")) return "js";

  const extension = /\.([^.\/]+)$/.exec(lower)?.[1];
  if (!extension) return undefined;

  const languages: Record<string, string> = {
    c: "c",
    css: "css",
    go: "go",
    h: "c",
    java: "java",
    py: "python",
    rs: "rust",
  };
  return languages[extension] ?? undefined;
}
