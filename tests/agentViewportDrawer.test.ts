import { readFileSync } from "node:fs";

const source = readFileSync("src/features/agent/AgentViewportDrawer.tsx", "utf8");

describe("AgentViewportDrawer browser preview", () => {
  it("renders the browser surface in a native embedded webview", () => {
    expect(source).toContain("<EmbeddedWebviewFrame");
    expect(source).toContain('const AGENT_BROWSER_LABEL = "agent-browser"');
    expect(source).toContain("visible={visible}");
    expect(source).not.toContain("<iframe");
    // Bounds sync belongs to EmbeddedWebviewFrame, not the drawer.
    expect(source).not.toContain("agentViewportSetBounds");
  });

  it("no longer warns about https embedding (native views are not frame-blocked)", () => {
    expect(source).not.toContain("HttpsPreviewWarning");
    expect(source).not.toContain("Some HTTPS sites block embedded previews");
  });

  it("follows native navigation in the url bar and history", () => {
    expect(source).toContain("const embeddedUrl = embeddedFrame?.url");
    expect(source).toContain("pushBrowserHistory(state, embeddedUrl)");
  });

  it("offloads a hidden webview to free memory unless kept active", () => {
    expect(source).toContain("keepViewportActive");
    expect(source).toContain("OFFLOAD_TIMEOUT_MS");
    expect(source).toContain("setFrameOffloaded(true)");
    expect(source).toContain("!frameOffloaded");
  });

  it("keeps tab chrome vertically centered", () => {
    expect(source).toContain("h-[52px] shrink-0 items-center");
    expect(source).toContain("min-w-0 flex-1 items-center");
  });

  it("renders viewport tabs from stored open order", () => {
    expect(source).toContain("const tabOrder = useViewportStore");
    expect(source).toContain("tabOrder.map");
  });

  it("lets viewport tabs drag-reorder on one horizontal row", () => {
    expect(source).toContain("const [draggingTab, setDraggingTab]");
    expect(source).toContain("event.currentTarget.setPointerCapture");
    expect(source).toContain("state.deltaX = Math.min(state.maxX, Math.max(state.minX, event.clientX - state.startX))");
    expect(source).toContain("applyTabDragTransforms(state)");
    expect(source).toContain("const draggedCenter = state.startCenter + state.deltaX");
    expect(source).toContain("moveTab(state.tab, target.tab, state.previewIndex < state.fromIndex ? \"before\" : \"after\")");
    expect(source).not.toContain("draggable");
    expect(source).toContain("h-8");
  });

  it("keeps tab drag movement off the React render path", () => {
    const moveBody = source.slice(source.indexOf("const moveTabDrag"), source.indexOf("const finishTabDrag"));

    expect(source).toContain("window.addEventListener(\"pointermove\", moveDrag");
    expect(source).not.toContain("onPointerMove={moveTabDrag}");
    expect(source).toContain("el.style.transform");
    expect(moveBody).not.toContain("setTabDragState");
    expect(moveBody).not.toContain("setDraggingTab");
    expect(source).not.toContain("transition-transform");
  });

  it("previews tab reorder by moving sibling tabs during drag", () => {
    expect(source).toContain("previewIndex: fromIndex");
    expect(source).toContain("state.previewIndex = getPreviewTabIndex(state)");
    expect(source).toContain("rects[index - 1].left - rect.left");
    expect(source).toContain("rects[index + 1].left - rect.left");
  });

  it("keeps the drawer close control inside the open drawer", () => {
    expect(source).toContain("PanelRightIcon");
    expect(source).toContain("aria-label=\"Hide viewport\"");
    expect(source).toContain("-scale-x-100");
  });

  it("keeps enough split width for chat", () => {
    expect(source).toContain('maxWidth: "calc(100% - 320px)"');
  });

  it("wires back and forward controls to preview history", () => {
    expect(source).toContain("onClick={() => moveHistory(-1)}");
    expect(source).toContain("onClick={() => moveHistory(1)}");
    expect(source).toContain("disabled={history.index <= 0}");
    expect(source).toContain("disabled={history.index >= history.entries.length - 1}");
    expect(source).not.toContain("iframeRef.current?.contentWindow?.history.back()");
    expect(source).not.toContain("iframeRef.current?.contentWindow?.history.forward()");
  });

  it("respects drawer performance settings", () => {
    expect(source).toContain("reduceMotion");
    expect(source).toContain("!reduceMotion &&");
  });
});
