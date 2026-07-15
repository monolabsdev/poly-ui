import { beforeEach, describe, expect, it } from "vitest";
import {
  mountFrame,
  notifyOverlayClosed,
  notifyOverlayOpened,
  setEmbeddedWebviewBridge,
  setFrameShown,
  unmountFrame,
  useEmbeddedWebviewStore,
  type EmbeddedWebviewBridge,
} from "../src/features/embedded-webview/embeddedWebviewStore";
import type { WebviewBounds } from "../src/features/embedded-webview/generated/WebviewBounds";

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (reason?: unknown) => void };

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

/** Flush promise continuations (and the setTimeout(0) uncover delay). */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 5));
}

class FakeBridge implements EmbeddedWebviewBridge {
  calls: string[] = [];
  pendingSnapshots: Deferred<string>[] = [];
  revoked: string[] = [];
  private snapshotSeq = 0;

  create(label: string, _url: string, _bounds: WebviewBounds): Promise<void> {
    this.calls.push(`create ${label}`);
    return Promise.resolve();
  }
  navigate(label: string, url: string): Promise<void> {
    this.calls.push(`navigate ${label} ${url}`);
    return Promise.resolve();
  }
  reload(label: string): Promise<void> {
    this.calls.push(`reload ${label}`);
    return Promise.resolve();
  }
  setBounds(label: string, _bounds: WebviewBounds): Promise<void> {
    this.calls.push(`bounds ${label}`);
    return Promise.resolve();
  }
  setVisible(label: string, visible: boolean): Promise<void> {
    this.calls.push(`visible ${label} ${visible}`);
    return Promise.resolve();
  }
  destroy(label: string): Promise<void> {
    this.calls.push(`destroy ${label}`);
    return Promise.resolve();
  }
  snapshot(label: string): Promise<string> {
    this.calls.push(`snapshot ${label} #${++this.snapshotSeq}`);
    const pending = deferred<string>();
    this.pendingSnapshots.push(pending);
    return pending.promise;
  }
  revokeSnapshot(url: string): void {
    this.revoked.push(url);
  }
}

let bridge: FakeBridge;

const frame = (label: string) => useEmbeddedWebviewStore.getState().frames[label];

beforeEach(() => {
  bridge = new FakeBridge();
  setEmbeddedWebviewBridge(bridge);
  useEmbeddedWebviewStore.setState({ frames: {}, overlayCount: 0 });
});

describe("overlay counting", () => {
  it("covers frames only on the 0 to 1 transition", async () => {
    mountFrame("page");
    notifyOverlayOpened();
    notifyOverlayOpened();
    await settle();

    expect(useEmbeddedWebviewStore.getState().overlayCount).toBe(2);
    expect(bridge.calls.filter((call) => call.startsWith("snapshot"))).toHaveLength(1);
  });

  it("uncovers only when the last overlay closes", async () => {
    mountFrame("page");
    notifyOverlayOpened();
    notifyOverlayOpened();
    bridge.pendingSnapshots[0].resolve("blob:snap-1");
    await settle();

    notifyOverlayClosed();
    await settle();
    expect(frame("page").covered).toBe(true);

    notifyOverlayClosed();
    await settle();
    expect(frame("page").covered).toBe(false);
    expect(useEmbeddedWebviewStore.getState().overlayCount).toBe(0);
  });

  it("never drops the count below zero", () => {
    notifyOverlayClosed();
    expect(useEmbeddedWebviewStore.getState().overlayCount).toBe(0);
  });
});

describe("cover and restore", () => {
  it("shows the snapshot, then hides the native view", async () => {
    mountFrame("page");
    notifyOverlayOpened();
    expect(bridge.calls).toContain("snapshot page #1");
    // Not hidden yet: the snapshot must be up first (no blank flash).
    expect(bridge.calls).not.toContain("visible page false");

    bridge.pendingSnapshots[0].resolve("blob:snap-1");
    await settle();
    expect(frame("page")).toMatchObject({ covered: true, snapshotUrl: "blob:snap-1" });
    expect(bridge.calls).toContain("visible page false");
  });

  it("restores the view and clears the snapshot a frame later", async () => {
    mountFrame("page");
    notifyOverlayOpened();
    bridge.pendingSnapshots[0].resolve("blob:snap-1");
    await settle();

    notifyOverlayClosed();
    await settle();
    expect(bridge.calls).toContain("visible page true");
    expect(frame("page")).toMatchObject({ covered: false, snapshotUrl: null });
    expect(bridge.revoked).toContain("blob:snap-1");
  });

  it("falls back to the neutral surface when the snapshot fails", async () => {
    mountFrame("page");
    notifyOverlayOpened();
    bridge.pendingSnapshots[0].reject({ kind: "unsupported", message: "no snapshots on this platform" });
    await settle();

    expect(frame("page")).toMatchObject({ covered: true, snapshotUrl: null, coverFallback: true });
    expect(bridge.calls).toContain("visible page false");
  });

  it("covers a frame that mounts while an overlay is already open", async () => {
    notifyOverlayOpened();
    mountFrame("late");
    bridge.pendingSnapshots[0].resolve("blob:late");
    await settle();

    expect(frame("late")).toMatchObject({ covered: true, snapshotUrl: "blob:late" });
  });

  it("revokes the snapshot when a covered frame unmounts", async () => {
    mountFrame("page");
    notifyOverlayOpened();
    bridge.pendingSnapshots[0].resolve("blob:snap-1");
    await settle();

    unmountFrame("page");
    expect(bridge.revoked).toContain("blob:snap-1");
    expect(frame("page")).toBeUndefined();
  });
});

describe("race tokens", () => {
  it("discards a snapshot that resolves after the overlay already closed", async () => {
    mountFrame("page");
    notifyOverlayOpened();
    notifyOverlayClosed();
    bridge.pendingSnapshots[0].resolve("blob:stale");
    await settle();

    expect(frame("page")).toMatchObject({ covered: false, snapshotUrl: null });
    expect(bridge.revoked).toContain("blob:stale");
    // The stale continuation must not have hidden the view.
    expect(bridge.calls).not.toContain("visible page false");
  });

  it("keeps the existing snapshot when re-covered before the restore finished", async () => {
    mountFrame("page");
    notifyOverlayOpened();
    bridge.pendingSnapshots[0].resolve("blob:snap-1");
    await settle();

    // Close and immediately re-open: the uncover's one-frame delay must not
    // clear the snapshot the new cover is relying on.
    notifyOverlayClosed();
    notifyOverlayOpened();
    await settle();

    expect(frame("page")).toMatchObject({ covered: true, snapshotUrl: "blob:snap-1" });
    // No second capture needed — the page was hidden mid-cycle.
    expect(bridge.calls.filter((call) => call.startsWith("snapshot"))).toHaveLength(1);
    expect(bridge.calls.filter((call) => call === "visible page false").length).toBeGreaterThanOrEqual(1);
  });

  it("skips snapshots for frames their host is hiding, and restores to hidden", async () => {
    mountFrame("page");
    await setFrameShown("page", false);
    expect(bridge.calls).toContain("visible page false");

    notifyOverlayOpened();
    await settle();
    // Nothing to occlude: no capture, frame stays uncovered.
    expect(bridge.calls.filter((call) => call.startsWith("snapshot"))).toHaveLength(0);
    expect(frame("page").covered).toBe(false);

    notifyOverlayClosed();
    await settle();
    // The uncover pass must not reveal a frame the host still hides.
    expect(bridge.calls.filter((call) => call === "visible page true")).toHaveLength(0);
  });

  it("covers instead of revealing when shown under an open overlay", async () => {
    mountFrame("page");
    await setFrameShown("page", false);
    notifyOverlayOpened();
    await settle();

    // Not awaited: the cover path resolves only once the snapshot lands below.
    void setFrameShown("page", true);
    bridge.pendingSnapshots[0].resolve("blob:snap-1");
    await settle();

    expect(frame("page")).toMatchObject({ covered: true, snapshotUrl: "blob:snap-1", shown: true });
    // Revealed only through the cover path, never directly under the overlay.
    expect(bridge.calls.filter((call) => call === "visible page true")).toHaveLength(0);

    notifyOverlayClosed();
    await settle();
    expect(bridge.calls).toContain("visible page true");
    expect(frame("page").covered).toBe(false);
  });

  it("ends visible and snapshot-free after rapid open/close cycles", async () => {
    mountFrame("page");
    for (let i = 0; i < 10; i++) {
      notifyOverlayOpened();
      notifyOverlayClosed();
    }
    for (const pending of bridge.pendingSnapshots) pending.resolve(`blob:${Math.random()}`);
    await settle();
    await settle();

    expect(useEmbeddedWebviewStore.getState().overlayCount).toBe(0);
    expect(frame("page")).toMatchObject({ covered: false, snapshotUrl: null, coverFallback: false });
    const lastVisible = bridge.calls.filter((call) => call.startsWith("visible page")).at(-1);
    expect(lastVisible === undefined || lastVisible === "visible page true").toBe(true);
  });
});
