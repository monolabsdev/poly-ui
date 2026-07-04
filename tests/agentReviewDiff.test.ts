import { describe, expect, it } from "vitest";
import { getDiffLanguage, parseUnifiedDiff } from "../src/features/agent/reviewDiff";

describe("agent review diff utilities", () => {
  it("keeps git metadata out of source rows so line numbers stay correct", () => {
    const rows = parseUnifiedDiff([
      "diff --git a/src/deleted.ts b/src/deleted.ts",
      "deleted file mode 100644",
      "index 1a2b3c4..0000000",
      "--- a/src/deleted.ts",
      "+++ /dev/null",
      "@@ -1,2 +0,0 @@",
      "-export const one = 1;",
      "-export const two = 2;",
    ].join("\n"));

    expect(rows.find((row) => row.text === "deleted file mode 100644")?.kind).toBe("meta");
    expect(rows.filter((row) => row.kind === "remove").map((row) => row.oldNumber)).toEqual([1, 2]);
  });

  it("detects the language used for changed files", () => {
    expect(getDiffLanguage("src/App.tsx")).toBe("tsx");
    expect(getDiffLanguage("src-tauri/src/lib.rs")).toBe("rust");
    expect(getDiffLanguage("styles/app.css")).toBe("css");
  });
});
