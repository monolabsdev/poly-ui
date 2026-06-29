import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("chat screen regression guards", () => {
  it("keeps the composer border subtle and temporary chats dashed", () => {
    const source = read("src/features/chat/components/ChatInput.tsx");

    expect(source).toContain("border-transparent");
    expect(source).toContain("hover:border-border");
    expect(source).toContain("focus-within:border-border");
    expect(source).toContain("border-dashed");
    expect(source).toContain("isTemporary");
    expect(source).not.toContain("focus-within:ring-2");
    expect(source).not.toContain("ring-ring/30");
  });

  it("keeps the prompt preset picker as a floating icon popover", () => {
    const source = read("src/features/chat/components/Header.tsx");

    expect(source).toContain("PopoverContent");
    expect(source).toContain("aria-label=\"Switch prompt preset\"");
    expect(source).toContain("ScrollText");
    expect(source).not.toContain("from \"@/components/ui/native-select\"");
  });

  it("keeps active chats in a scroll container with styled role bubbles", () => {
    const chatArea = read("src/features/chat/components/ChatArea.tsx");
    const userMessage = read("src/features/chat/components/Message/UserMessage.tsx");
    const assistantMessage = read("src/features/chat/components/Message/AssistantMessage.tsx");

    expect(chatArea).toContain("flex-1 overflow-y-auto");
    expect(chatArea).toContain("relative mx-auto");
    expect(userMessage).toContain("ml-auto");
    expect(userMessage).toContain("bg-muted");
    expect(assistantMessage).toContain("mr-auto");
    expect(assistantMessage).toContain("bg-card");
    expect(assistantMessage).toContain("action-bar");
  });

  it("keeps chat overlays portaled, stacked, and styled", () => {
    const css = read("src/App.css");
    const tooltip = read("src/components/ui/tooltip.tsx");
    const popover = read("src/components/ui/popover.tsx");
    const dropdown = read("src/components/ui/dropdown-menu.tsx");
    const slashMenu = read("src/features/chat/components/ChatInput/SlashCommandMenu.tsx");
    const chatInput = read("src/features/chat/components/ChatInput.tsx");
    const profile = read("src/features/profile/ProfileMenu.tsx");

    expect(css).toContain("--z-dropdown: calc(var(--z-titlebar) + 10)");
    expect(css).toContain("--z-popover: calc(var(--z-titlebar) + 20)");
    expect(css).toContain("--z-tooltip: calc(var(--z-titlebar) + 30)");
    expect(dropdown).toContain("z-50");
    expect(popover).toContain("z-[var(--z-popover)]");
    expect(tooltip).toContain("z-[var(--z-tooltip)]");
    expect(slashMenu).toContain("bg-popover/95");
    expect(slashMenu).toContain("role=\"listbox\"");
    expect(slashMenu).toContain("backdrop-blur-xl");
    expect(slashMenu).not.toContain("style={{ color:");
    expect(chatInput).toContain("whitespace-nowrap");
    expect(profile).toContain("flex min-w-0 items-center gap-2");
    expect(profile).toContain("flex min-w-0 flex-1 flex-col");
  });
});
