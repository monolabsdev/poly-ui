import {
  openEmptyViewport,
  openViewportReview,
  closeViewportBrowser,
  closeViewportReview,
  useViewportStore,
} from "../src/features/agent/viewportStore";

const resetViewportStore = () => {
  useViewportStore.setState({
    session: null,
    review: null,
    browserOpen: false,
    activeTab: "browser",
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
      session: null,
      review: null,
    });
  });

  it("keeps summary opt-in and closable without closing the browser tab", () => {
    openEmptyViewport();
    openViewportReview({ fallbackFiles: [], toolCalls: {} });

    expect(useViewportStore.getState()).toMatchObject({
      drawerOpen: true,
      activeTab: "review",
      review: { fallbackFiles: [] },
    });

    closeViewportReview();

    expect(useViewportStore.getState()).toMatchObject({
      drawerOpen: true,
      activeTab: "browser",
      review: null,
    });
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
      session: null,
      review: { fallbackFiles: [] },
    });
  });
});
