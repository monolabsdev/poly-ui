import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("AgentReviewPanel", () => {
  it("uses the shared sheet drawer for review changes", () => {
    const source = readFileSync("src/features/agent/AgentReviewPanel.tsx", "utf8");

    expect(source).toContain("@/components/ui/sheet");
    expect(source).toContain("<Sheet open={open}");
    expect(source).toMatch(/<SheetContent[\s\S]*side="right"/);
    expect(source).not.toContain('className="fixed inset-x-0 bottom-0 top-[var(--titlebar-height)]');
  });

  it("does not render a file-list sidebar inside the drawer", () => {
    const source = readFileSync("src/features/agent/AgentReviewPanel.tsx", "utf8");

    expect(source).not.toContain("<nav");
    expect(source).not.toContain("md:grid-cols-[240px_minmax(0,1fr)]");
  });
});
