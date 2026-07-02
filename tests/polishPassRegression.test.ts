import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Poly polish pass guards", () => {
  it("defines global motion, radius, scrollbar, reveal, and shimmer primitives", () => {
    const css = read("src/App.css");
    const textShimmer = read("src/components/ui/text-shimmer.tsx");
    const shimmerBlock = css.match(/\.poly-shimmer \{[\s\S]*?\n\}/)?.[0] ?? "";

    expect(css).toContain("--dur-fast: 160ms");
    expect(css).toContain("--dur-base: 240ms");
    expect(css).toContain("--dur-slow: 320ms");
    expect(css).toContain("--ease-premium: cubic-bezier(0.16, 1, 0.3, 1)");
    expect(css).toContain("--ease-soft: cubic-bezier(0.4, 0, 0.2, 1)");
    expect(css).toContain("--radius-sm: calc(var(--radius) * 0.6)");
    expect(css).toContain("scrollbar-width: none");
    expect(css).toContain("html *::-webkit-scrollbar");
    expect(css).toContain("--dur-slow: 0.01ms");
    expect(css).toContain(".poly-reveal");
    expect(css).toContain("grid-template-rows: 0fr");
    expect(css).toContain("@keyframes poly-shimmer");
    expect(css).toContain(".poly-shimmer");
    expect(shimmerBlock).toContain("var(--color-foreground)");
    expect(shimmerBlock).toContain("var(--color-muted-foreground)");
    expect(shimmerBlock).not.toContain("var(--color-background)");
    expect(css).toContain("html.reduce-motion .poly-shimmer");
    expect(textShimmer).toContain("\"poly-shimmer bg-clip-text font-medium text-transparent\"");
    expect(textShimmer).toContain("--shimmer-duration");
    expect(textShimmer).toContain("--shimmer-spread");
    expect(css).toContain(".zoom-content");
    expect(css).toContain(".zoom-exempt");
  });

  it("keeps shared shadcn primitives premium by default", () => {
    const button = read("src/components/ui/button.tsx");
    const input = read("src/components/ui/input.tsx");
    const select = read("src/components/ui/select.tsx");
    const scrollArea = read("src/components/ui/scroll-area.tsx");
    const popover = read("src/components/ui/popover.tsx");
    const dropdown = read("src/components/ui/dropdown-menu.tsx");
    const tooltip = read("src/components/ui/tooltip.tsx");

    expect(button).toContain("group/button");
    expect(button).toContain("active:not-aria-[haspopup]:translate-y-px");
    expect(select).toContain("duration-[var(--dur-base)]");
    expect(select).toContain("ease-[var(--ease-soft)]");
    expect(select).toContain("bg-popover");
    expect(select).not.toContain("backdrop-blur");
    expect(scrollArea).toContain("data-horizontal:h-2.5");
    expect(scrollArea).toContain("data-vertical:w-2.5");
    expect(scrollArea).toContain("bg-border");
    expect(popover).toContain("bg-popover");
    expect(popover).not.toContain("backdrop-blur");
    expect(dropdown).toContain("bg-popover");
    expect(dropdown).toContain("dropdown-menu-content");
    expect(tooltip).toContain("bg-foreground");
    expect(tooltip).toContain("rounded-xl");
  });

  it("uses shared tab pill, presence, kbd, and platform shortcut helpers", () => {
    const tabs = read("src/components/ui/tabs.tsx");
    const presence = read("src/hooks/usePresence.ts");
    const platform = read("src/lib/platform.ts");
    const kbd = read("src/components/ui/kbd.tsx");

    expect(tabs).toContain("data-slot=\"tabs-pill\"");
    expect(tabs).toContain("ResizeObserver");
    expect(tabs).toContain("requestAnimationFrame");
    expect(tabs).toContain("var(--ease-premium)");
    expect(presence).toContain("mounted");
    expect(presence).toContain("state:");
    expect(platform).toContain("MOD_KEY");
    expect(platform).toContain("fmtShortcut");
    expect(kbd).toContain("data-slot=\"kbd\"");
    expect(kbd).toContain("in-data-[slot=tooltip-content]:bg-background/20");
  });

  it("prevents startup theme flash and applies app zoom through CSS", () => {
    const html = read("index.html");
    const main = read("src/main.tsx");
    const settings = read("src/store/settingsStore.ts");

    expect(html).toContain("localStorage.getItem('polyui:settings')");
    expect(html).toContain("document.documentElement.classList.toggle('dark'");
    expect(html).toContain("document.documentElement.style.backgroundColor");
    expect(main).toContain("className=\"app-content zoom-content animate-fade-in\"");
    expect(main).toContain("document.documentElement.style.setProperty");
    expect(main).toContain("\"--app-zoom\"");
    expect(settings).toContain("appZoom: number");
  });

  it("uses the sticky-bottom hook for chat scrolling", () => {
    const pkg = read("package.json");
    const chatArea = read("src/features/chat/components/ChatArea.tsx");

    expect(pkg).toContain("use-stick-to-bottom");
    expect(chatArea).toContain("useStickToBottom({ initial: \"smooth\", resize: \"smooth\" })");
    expect(chatArea).toContain("stickToBottom.scrollToBottom(\"smooth\")");
  });

  it("removes hardcoded duration-200 and ease-out from active UI source", () => {
    const files = [
      "src/App.css",
      "src/components/ui/native-select.tsx",
      "src/components/ui/select.tsx",
      "src/components/ui/input-group.tsx",
      "src/components/ui/visibility.tsx",
      "src/features/chat/components/ChatArea.tsx",
      "src/features/chat/components/Message/UserMessage.tsx",
      "src/features/chat/components/Message/AssistantMessage.tsx",
    ];

    for (const file of files) {
      const source = read(file);
      expect(source, file).not.toContain("duration-200");
      expect(source, file).not.toContain("ease-out");
    }
  });

  it("keeps focus rings keyboard-only", () => {
    const css = read("src/App.css");
    const badge = read("src/components/ui/badge.tsx");
    const button = read("src/components/ui/button.tsx");
    const chip = read("src/components/ui/chip.tsx");
    const dropdown = read("src/components/ui/dropdown-menu.tsx");
    const select = read("src/components/ui/select.tsx");
    const command = read("src/components/ui/command.tsx");
    const files = [
      "src/components/ui/dropdown-menu.tsx",
      "src/components/ui/select.tsx",
      "src/features/agent/AgentComposerControls.tsx",
      "src/features/folders/CreateFolderModal.tsx",
    ];

    expect(css).toContain(":focus:not(:focus-visible)");
    expect(css).toContain("box-shadow: none");
    expect(css).toContain("button:focus-visible");
    expect(css).toContain("[data-slot=\"dropdown-menu-trigger\"]:focus-visible > [data-slot=\"badge\"]");
    expect(badge).toContain("focus-visible:ring-1");
    expect(button).toContain("focus-visible:ring-1");
    expect(chip).toContain("hover:bg-white/[0.06]");
    expect(dropdown).toContain("data-[highlighted]:bg-white/[0.06]");
    expect(select).toContain("data-[highlighted]:bg-white/[0.06]");
    expect(command).toContain("data-selected:bg-white/[0.06]");

    for (const file of files) {
      const source = read(file);
      expect(source, file).not.toMatch(/\bfocus:bg-(accent|muted|white|primary|secondary)/);
      expect(source, file).not.toMatch(/\bfocus:(text|border)-/);
      expect(source, file).not.toMatch(/\bfocus:ring-[1-9]/);
      expect(source, file).not.toContain("focus-visible:ring-3");
    }
  });
});
