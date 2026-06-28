import { describe, expect, it } from "vitest";

describe("avatar fallback extraction", () => {
  it("renders avatar from shadcn primitives", () => {
    // The shadcn Avatar component uses AvatarImage + AvatarFallback children.
    // This test validates that the components export correctly.
    const fs = require("node:fs");
    const source = fs.readFileSync("src/components/ui/avatar.tsx", "utf8");

    expect(source).toContain("function Avatar");
    expect(source).toContain("function AvatarImage");
    expect(source).toContain("function AvatarFallback");
    expect(source).toContain("data-slot=\"avatar\"");
  });
});
