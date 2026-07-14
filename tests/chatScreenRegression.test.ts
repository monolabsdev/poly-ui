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

  it("recognizes Linux file drag payloads for the composer drop state", () => {
    const source = read("src/features/chat/hooks/useFileDragDetection.ts");

    expect(source).toContain("text/uri-list");
    expect(source).toContain("application/x-moz-file");
  });

  it("reads dropped files via Tauri's native drag-drop event for WebKitGTK", () => {
    const source = read("src/features/chat/hooks/useFileDragDetection.ts");

    expect(source).toContain("onDragDropEvent");
    expect(source).toContain("readFile");
  });

  it("enables native window drag-drop on Linux", () => {
    const source = read("src-tauri/tauri.linux.conf.json");

    expect(source).toContain("\"dragDropEnabled\": true");
  });

  it("uses a centered overlay instead of an active composer outline for file drops", () => {
    const source = read("src/features/chat/components/ChatInput.tsx");
    const css = read("src/App.css");

    expect(source).toContain("createPortal");
    expect(source).toContain("document.body");
    expect(source).toContain("chat-file-drop-overlay");
    expect(source).toContain("className=\"sr-only\"");
    expect(source).toContain("<h2 className=\"chat-file-drop-overlay__title\">");
    expect(source).toContain("<p className=\"chat-file-drop-overlay__copy\">");
    expect(source).toContain("Add anything");
    expect(source).toContain("Drop any file here to add it to the conversation");
    expect(source).not.toContain("chat-file-drop-target--active");
    expect(css).toContain(".chat-file-drop-overlay");
    expect(css).toContain("inset: 0");
    expect(css).toContain("z-index: 1");
    expect(css).toContain("color: white");
    expect(css).toContain("background: rgb(0 0 0 / 0.72)");
    expect(css).not.toContain("top: calc(var(--titlebar-height)");
    expect(css).not.toContain(".chat-file-drop-target--active");
  });

  it("uses prompt-kit style action buttons in the composer", () => {
    const source = read("src/features/chat/components/ChatInput.tsx");

    expect(source).toContain("import { Button } from \"@/components/ui/button\"");
    expect(source).toContain("MoreHorizontal");
    expect(source).toContain("Globe");
    expect(source).toContain("rounded-full");
    expect(source).toContain("variant=\"outline\"");
    expect(source).toContain("Search");
    expect(source).toContain("More actions");
    expect(source).toContain("bg-info-soft");
    expect(source).toContain("text-info");
    expect(source).not.toContain("ActiveFeaturesList");
    expect(source).not.toContain("bg-white/[0.08]");
    expect(source).toContain("mode=\"all\"");
    expect(source).not.toContain("mode=\"permission\"");
    expect(source).not.toContain("mode=\"workspace\"");
  });

  it("keeps the prompt preset picker as a floating icon popover", () => {
    const source = read("src/features/chat/components/Header.tsx");

    expect(source).toContain("PopoverContent");
    expect(source).toContain("aria-label=\"Switch prompt preset\"");
    expect(source).toContain("ScrollText");
    expect(source).not.toContain("from \"@/components/ui/native-select\"");
  });

  it("shows the viewport drawer opener only while the drawer is closed", () => {
    const source = read("src/features/chat/components/Header.tsx");

    expect(source).toContain("useViewportStore");
    expect(source).toContain("{!viewportDrawerOpen ? (");
    expect(source).toContain("flex h-16 shrink-0 items-start gap-3");
    expect(source).toContain("min-w-0 flex-1 overflow-hidden");
    expect(source).toContain("flex shrink-0 items-center gap-2");
    expect(source).toContain("PanelRightIcon");
    expect(source).not.toContain("aria-pressed={viewportDrawerOpen}");
  });

  it("keeps header icon labels centered and borderless chrome painted without changing layout", () => {
    const header = read("src/features/chat/components/Header.tsx");
    const css = read("src/App.css");

    expect(header).toContain("inline-flex items-center gap-1.5");
    expect(header).toContain("flex size-4 items-center justify-center");
    expect(css).toContain("vertical-align: middle;");
    expect(css).toContain("min-height: 100vh;");
    expect(css).toContain("outline: 1px solid var(--border);");
    expect(css).toContain("outline-offset: -1px;");
    expect(css).not.toContain("html[data-chrome=\"borderless\"] #root {\n    overflow: hidden;\n    border:");
    expect(css).toContain("html[data-chrome=\"borderless\"].maximized #root {\n    border-radius: 0;\n    outline: none;");
    expect(css).toContain(".app-root-shell {\n    background: var(--sidebar);");
  });

  it("resets composer textarea before empty placeholder paints", () => {
    const hook = read("src/features/chat/hooks/useAutoResizeTextarea.ts");

    expect(hook).toContain("useLayoutEffect");
    expect(hook).toContain("if (!draft.trim())");
    expect(hook).toContain("el.scrollTop = 0");
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
    expect(assistantMessage).toContain("text-card-foreground");
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

    expect(css).toContain("--z-modal: calc(var(--z-titlebar) + 10)");
    expect(css).toContain("--z-dropdown: calc(var(--z-titlebar) + 20)");
    expect(css).toContain("--z-popover: calc(var(--z-titlebar) + 30)");
    expect(css).toContain("--z-tooltip: calc(var(--z-titlebar) + 40)");
    expect(dropdown).toContain("z-50");
    expect(popover).toContain("z-[var(--z-popover)]");
    expect(tooltip).toContain("z-[var(--z-tooltip)]");
    expect(slashMenu).toContain("bg-popover");
    expect(slashMenu).toContain("role=\"listbox\"");
    expect(slashMenu).not.toContain("backdrop-blur");
    expect(slashMenu).not.toContain("style={{ color:");
    expect(chatInput).toContain("whitespace-nowrap");
    expect(profile).toContain("flex min-w-0 items-center gap-2");
    expect(profile).toContain("flex min-w-0 flex-1 flex-col");
  });

  it("keeps the thinking indicator on Prompt Kit shimmer", () => {
    const thinking = read("src/features/chat/components/Message/ThinkingDisclosure.tsx");

    expect(thinking).toContain("TextShimmer");
    expect(thinking).toContain("duration={2}");
    expect(thinking).toContain("spread={15}");
  });
});
