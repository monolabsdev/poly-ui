import { readdirSync, readFileSync, type Dirent } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC_ROOT = join(process.cwd(), "src");
const TRACKED_MODULES = [
  "@/store/updateStore",
  "@/features/providers",
  "@/lib/repositories",
];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry: Dirent) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return walk(path);
      return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
    });
}

describe("import chunk discipline", () => {
  it("does not mix static and dynamic imports for modules that Vite cannot split", () => {
    const files = walk(SRC_ROOT);
    const mixedImports = TRACKED_MODULES.flatMap((moduleId) => {
      const staticSites: string[] = [];
      const dynamicSites: string[] = [];
      const staticPattern = new RegExp(`(?:from|import)\\s+[\\s\\S]*?["']${moduleId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']`);
      const dynamicPattern = new RegExp(`import\\(["']${moduleId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["']\\)`);

      for (const file of files) {
        const source = readFileSync(file, "utf8");
        const label = relative(process.cwd(), file);
        if (staticPattern.test(source)) staticSites.push(label);
        if (dynamicPattern.test(source)) dynamicSites.push(label);
      }

      return staticSites.length > 0 && dynamicSites.length > 0
        ? [`${moduleId}: static=${staticSites.join(", ")} dynamic=${dynamicSites.join(", ")}`]
        : [];
    });

    expect(mixedImports).toEqual([]);
  });
});
