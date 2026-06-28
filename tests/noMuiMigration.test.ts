import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const bannedPatterns = [
  /@mui\//,
  /@emotion\//,
  /\bsx=/,
  /\bSxProps\b/,
  /\bThemeProvider\b/,
  /\bCssBaseline\b/,
  /\buseTheme\b/,
  /\bstyled\(/,
  /\bMui[A-Z]/,
  /\.Mui[A-Za-z-]+/,
];

const textFilePattern = /\.(ts|tsx|js|jsx|css|json)$/;

function collectFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (name === "node_modules" || name === "dist" || name === ".git") return [];
    if (statSync(path).isDirectory()) return collectFiles(path);
    return textFilePattern.test(path) ? [path] : [];
  });
}

describe("MUI migration", () => {
  it("has no MUI or Emotion usage left", () => {
    const offenders = collectFiles(join(root, "src"))
      .concat([join(root, "package.json"), join(root, "vite.config.ts")])
      .filter((file) => {
        const content = readFileSync(file, "utf8");
        return bannedPatterns.some((pattern) => pattern.test(content));
      })
      .map((file) => relative(root, file));

    expect(offenders).toEqual([]);
  });
});
