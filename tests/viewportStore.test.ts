import {
  openEmptyViewport,
  openViewportForUser,
  openViewportReview,
  closeViewportBrowser,
  closeViewportReview,
  type ViewportTab,
  useViewportStore,
} from "../src/features/agent/viewportStore";

const resetViewportStore = () => {
  useViewportStore.setState({
    session: null,
    review: null,
    browserOpen: false,
    activeTab: "browser",
    tabOrder: [],
    drawerOpen: false,
    drawerWidth: 440,
  });
};

describe("viewport drawer state", () => {
  beforeEach(resetViewportStore);

  it("opens an empty browser drawer without creating a summary tab", () => {
    openEmptyViewport();

    expect(useViewportStore.getState()).toMatchObject({
      drawerOpen: true,
      activeTab: "browser",
      tabOrder: ["browser"],
      session: null,
      review: null,
    });
  });

  it("opens user links as iframe preview sessions without native loading state", async () => {
    await openViewportForUser("https://example.com");

    expect(useViewportStore.getState()).toMatchObject({
      drawerOpen: true,
      browserOpen: true,
      activeTab: "browser",
      tabOrder: ["browser"],
      session: {
        runId: "user",
        openedBy: "user",
        url: "https://example.com/",
        status: "ready",
      },
    });
  });

  it("ignores non-http preview urls", async () => {
    await openViewportForUser("javascript:alert(1)");

    expect(useViewportStore.getState().session).toBeNull();
    expect(useViewportStore.getState().drawerOpen).toBe(false);
  });

  it("keeps summary opt-in and closable without closing the browser tab", () => {
    openEmptyViewport();
    openViewportReview({ fallbackFiles: [], toolCalls: {} });

    expect(useViewportStore.getState()).toMatchObject({
      drawerOpen: true,
      activeTab: "review",
      tabOrder: ["browser", "review"],
      review: { fallbackFiles: [] },
    });

    closeViewportReview();

    expect(useViewportStore.getState()).toMatchObject({
      drawerOpen: true,
      activeTab: "browser",
      tabOrder: ["browser"],
      review: null,
    });
  });

  it("keeps viewport tabs in the order they were opened", () => {
    openViewportReview({ fallbackFiles: [], toolCalls: {} });
    openEmptyViewport();

    expect(useViewportStore.getState()).toMatchObject({
      activeTab: "browser",
      tabOrder: ["review", "browser"],
    });
  });

  it("moves viewport tabs before or after each other", () => {
    openEmptyViewport();
    openViewportReview({ fallbackFiles: [], toolCalls: {} });

    useViewportStore.getState().actions.moveTab("browser", "review", "after");

    expect(useViewportStore.getState().tabOrder).toEqual(["review", "browser"]);

    useViewportStore.getState().actions.moveTab("browser", "review", "before");

    expect(useViewportStore.getState().tabOrder).toEqual(["browser", "review"]);
  });

  it("ignores tab moves for missing tabs", () => {
    openEmptyViewport();

    useViewportStore.getState().actions.moveTab("browser", "review" as ViewportTab, "before");

    expect(useViewportStore.getState().tabOrder).toEqual(["browser"]);
  });

  it("closes the browser tab but leaves an open summary visible", () => {
    useViewportStore.getState().actions.opened({
      runId: "run",
      chatId: null,
      kind: "url",
      openedBy: "user",
      label: "https://example.com",
      url: "https://example.com",
      reason: null,
    });
    openViewportReview({ fallbackFiles: [], toolCalls: {} });

    closeViewportBrowser();

    expect(useViewportStore.getState()).toMatchObject({
      drawerOpen: true,
      activeTab: "review",
      tabOrder: ["review"],
      session: null,
      review: { fallbackFiles: [] },
    });
  });
});
