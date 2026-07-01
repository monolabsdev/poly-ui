import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const files = [
  "src/components/app-sidebar.tsx",
  "src/features/sidebar/components/sidebar-utils.tsx",
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
    const sidebarUtils = readFileSync(
      "src/features/sidebar/components/sidebar-utils.tsx",
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

    expect(sidebarUtils).toContain("sidebarIconButtonClassName");
    expect(sidebarUtils).toContain("items-center");
    expect(sidebarUtils).toContain("justify-center");
    expect(folders).toContain("sidebarIconButtonClassName");
    expect(guestFooter).toContain("sidebarIconButtonClassName");
  });

  it("shows a divider below the collapsed sidebar trigger only when collapsed", () => {
    const brand = readFileSync(
      "src/features/sidebar/components/SidebarBrand.tsx",
      "utf8",
    );

    expect(brand).toContain('data-testid="collapsed-sidebar-trigger-divider"');
    expect(brand).toContain("{isCollapsed && (");
    expect(brand).toContain("absolute top-[calc(var(--sidebar-icon-button)+var(--sidebar-padding)*0.5)]");
    expect(brand).toContain("bg-sidebar-border");
    expect(brand).not.toContain('"flex-col justify-center gap-2"');
  });

  it("supports a persisted collapsible folders section", () => {
    const folders = readFileSync(
      "src/features/sidebar/components/FoldersSection.tsx",
      "utf8",
    );

    expect(folders).toContain("useFoldersSectionCollapsed");
    expect(folders).toContain("expanded: !isCollapsed");
    expect(folders).toContain("SidebarSectionHeader");
    expect(folders).toContain("disclosure");
    expect(folders).toContain("polyui:sidebar:folders-collapsed");
  });
});
