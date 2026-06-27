import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const files = [
  "src/features/sidebar/Sidebar.tsx",
  "src/features/sidebar/components/SidebarPrimitives.tsx",
  "src/features/sidebar/components/SidebarBrand.tsx",
  "src/features/sidebar/components/FoldersSection.tsx",
  "src/features/sidebar/components/FolderTree.tsx",
  "src/features/sidebar/components/ConversationList.tsx",
  "src/features/sidebar/components/ConversationSkeleton.tsx",
  "src/features/sidebar/components/GuestFooter.tsx",
  "src/features/chat/components/ConversationItem.tsx",
  "src/features/profile/ProfileMenu.tsx",
];

const forbiddenVisualPatterns = [
  /#[0-9a-f]{3,8}\b/i,
  /\brgba?\(/i,
  /fontSize:\s*(?:"\d|\d)/,
  /letterSpacing:\s*["'][^"']+["']/,
  /borderRadius:\s*["'](?:\d|50%|9999px)/,
  /transition:\s*["'][^"']*(?:ms|s|ease|cubic)/,
];

describe("sidebar visual tokens", () => {
  it("keeps sidebar widths on the required desktop rail sizes", () => {
    const source = readFileSync("src/features/sidebar/Sidebar.tsx", "utf8");

    expect(source).toContain("const EXPANDED_WIDTH = 272");
    expect(source).toContain("const COLLAPSED_WIDTH = 64");
  });

  it("avoids hardcoded visual tokens in sidebar presentation files", () => {
    const offenders = files.flatMap((file) => {
      const source = readFileSync(file, "utf8");

      return forbiddenVisualPatterns.flatMap((pattern) =>
        pattern.test(source) ? [`${file}: ${pattern}`] : [],
      );
    });

    expect(offenders).toEqual([]);
  });

  it("keeps guest footer flat instead of card-like", () => {
    const source = readFileSync(
      "src/features/sidebar/components/GuestFooter.tsx",
      "utf8",
    );

    expect(source).toContain("data-testid=\"guest-footer-flat\"");
    expect(source).not.toContain("borderColor");
    expect(source).not.toContain("boxShadow");
  });

  it("uses shared centered icon button styles for sidebar icon controls", () => {
    const primitives = readFileSync(
      "src/features/sidebar/components/SidebarPrimitives.tsx",
      "utf8",
    );
    const folders = readFileSync(
      "src/features/sidebar/components/FoldersSection.tsx",
      "utf8",
    );
    const guestFooter = readFileSync(
      "src/features/sidebar/components/GuestFooter.tsx",
      "utf8",
    );

    expect(primitives).toContain("sidebarIconButtonSx");
    expect(primitives).toContain("alignItems: \"center\"");
    expect(primitives).toContain("justifyContent: \"center\"");
    expect(folders).toContain("sidebarIconButtonSx");
    expect(guestFooter).toContain("sidebarIconButtonSx");
  });
});
