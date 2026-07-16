import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyEmbeddedWebviewEvent,
  mountFrame,
  notifyOverlayClosed,
  notifyOverlayOpened,
  resetEmbeddedWebviewInternals,
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
  // Deterministically drain the async chains the overlay engine schedules
  // (promise microtasks + afterPaint's nested setTimeout(0) macrotasks),
  // rather than racing a fixed wall-clock delay that flakes under load.
  for (let i = 0; i < 6; i += 1) {
    await Promise.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

class FakeBridge implements EmbeddedWebviewBridge {
  calls: string[] = [];
  pendingSnapshots: Deferred<string>[] = [];
  revoked: string[] = [];
  /** When set, snapshot() resolves immediately instead of deferring. */
  autoResolve = false;
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
    if (this.autoResolve) return Promise.resolve(`blob:auto-${this.snapshotSeq}`);
    const pending = deferred<string>();
    this.pendingSnapshots.push(pending);
    return pending.promise;
  }
  snapshotCount(): number {
    return this.calls.filter((call) => call.startsWith("snapshot")).length;
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
  // Clear any idle-refresh / watchdog timers left running by a prior test so
  // they can't fire mid-test and add stray snapshot calls.
  resetEmbeddedWebviewInternals();
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

  it("restores the view, clears the snapshot after paint, and keeps it as warm cache", async () => {
    mountFrame("page");
    notifyOverlayOpened();
    bridge.pendingSnapshots[0].resolve("blob:snap-1");
    await settle();

    notifyOverlayClosed();
    await settle();
    expect(bridge.calls).toContain("visible page true");
    expect(frame("page")).toMatchObject({
      covered: false,
      snapshotUrl: null,
      cachedSnapshotUrl: "blob:snap-1",
    });
    expect(bridge.revoked).not.toContain("blob:snap-1");
    // The visible page is re-captured so the next cover shows fresh content.
    expect(bridge.calls.filter((call) => call.startsWith("snapshot"))).toHaveLength(2);
  });

  it("covers instantly from the warm cache on later overlays", async () => {
    mountFrame("page");
    notifyOverlayOpened();
    bridge.pendingSnapshots[0].resolve("blob:snap-1");
    await settle();
    notifyOverlayClosed();
    await settle();
    bridge.pendingSnapshots[1].resolve("blob:fresh");
    await settle();
    // The refresh replaced the cache and released the older blob.
    expect(frame("page").cachedSnapshotUrl).toBe("blob:fresh");
    expect(bridge.revoked).toContain("blob:snap-1");

    notifyOverlayOpened();
    await settle();
    // Covered and hidden without waiting on a new capture.
    expect(frame("page")).toMatchObject({ covered: true, snapshotUrl: "blob:fresh" });
    expect(bridge.calls.filter((call) => call.startsWith("snapshot"))).toHaveLength(2);
    // One hide per cover: the first (slow-path) cover and this cached one.
    expect(bridge.calls.filter((call) => call === "visible page false")).toHaveLength(2);
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
  it("keeps a snapshot that resolves after the overlay closed as cache, without hiding", async () => {
    mountFrame("page");
    notifyOverlayOpened();
    notifyOverlayClosed();
    bridge.pendingSnapshots[0].resolve("blob:stale");
    await settle();

    // Not displayed — but retained to warm the next cover.
    expect(frame("page")).toMatchObject({
      covered: false,
      snapshotUrl: null,
      cachedSnapshotUrl: "blob:stale",
    });
    expect(bridge.revoked).not.toContain("blob:stale");
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

describe("idle warm-cache refresh", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // Arm the refresh loop via an open→close cycle (uncover arms it), then
  // return the snapshot count once the frame is live again.
  async function armViaCycle(): Promise<void> {
    bridge.autoResolve = true;
    mountFrame("page");
    notifyOverlayOpened();
    await vi.advanceTimersByTimeAsync(50);
    notifyOverlayClosed();
    await vi.advanceTimersByTimeAsync(50);
  }

  it("re-captures the visible page on the idle cadence", async () => {
    await armViaCycle();
    const before = bridge.snapshotCount();

    await vi.advanceTimersByTimeAsync(2000);
    expect(bridge.snapshotCount()).toBe(before + 1);

    // Loop is self-sustaining while eligible.
    await vi.advanceTimersByTimeAsync(2000);
    expect(bridge.snapshotCount()).toBe(before + 2);
  });

  it("stops re-capturing once an overlay covers the frame", async () => {
    await armViaCycle();
    notifyOverlayOpened();
    await vi.advanceTimersByTimeAsync(50);
    const covered = bridge.snapshotCount();

    // No idle captures while covered.
    await vi.advanceTimersByTimeAsync(6000);
    expect(bridge.snapshotCount()).toBe(covered);
  });

  it("stops re-capturing once the frame is hidden by its host", async () => {
    await armViaCycle();
    await setFrameShown("page", false);
    const hidden = bridge.snapshotCount();

    await vi.advanceTimersByTimeAsync(6000);
    expect(bridge.snapshotCount()).toBe(hidden);
  });

  it("drops the loading status if a load never reports finished", async () => {
    mountFrame("page");
    applyEmbeddedWebviewEvent({ label: "page", event: { kind: "loadStarted", url: "https://x" } });
    expect(frame("page").status).toBe("loading");

    await vi.advanceTimersByTimeAsync(20_000);
    expect(frame("page").status).toBe("ready");
  });

  it("clears the watchdog when the load finishes normally", async () => {
    bridge.autoResolve = true;
    mountFrame("page");
    applyEmbeddedWebviewEvent({ label: "page", event: { kind: "loadStarted", url: "https://x" } });
    applyEmbeddedWebviewEvent({ label: "page", event: { kind: "loadFinished", url: "https://x" } });
    expect(frame("page").status).toBe("ready");

    // The fired watchdog must not later stomp a legitimately-ready page.
    await vi.advanceTimersByTimeAsync(20_000);
    expect(frame("page").status).toBe("ready");
  });
});
