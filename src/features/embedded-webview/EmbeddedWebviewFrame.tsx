import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import type { WebviewBounds } from "./generated/WebviewBounds";
import {
  getEmbeddedWebviewBridge,
  mountFrame,
  unmountFrame,
  useEmbeddedWebviewStore,
} from "./embeddedWebviewStore";

/**
 * Placeholder for a native embedded webview. The native view (owned by
 * src-tauri/src/embedded_webview) is kept aligned with this div: bounds are
 * re-synced on element resize, window resize, ancestor scroll, device pixel
 * ratio changes, and — per animation frame — while a layout transition runs
 * (sidebar collapse, drawer resize). Layout animations are detected through
 * bubbling `transitionrun`/`transitionend` DOM events on layout-affecting
 * properties, with the loop deadline read from the transition's own computed
 * duration, so no polling and no duplicated duration constants.
 *
 * While an overlay covers the page (see embeddedWebviewStore), the placeholder
 * shows the page snapshot — or a neutral surface if snapshots are unavailable —
 * so there is never a blank flash.
 */

/** Transition properties that can move or resize this element. */
const LAYOUT_TRANSITION_PROPERTIES = new Set([
  "width",
  "height",
  "left",
  "right",
  "top",
  "bottom",
  "margin",
  "margin-left",
  "margin-right",
  "margin-top",
  "margin-bottom",
  "padding",
  "transform",
  "flex-basis",
  "grid-template-columns",
  "grid-template-rows",
]);

/**
 * Snap logical bounds onto the physical pixel grid so the native view never
 * straddles a device pixel (Rust receives logical units and converts using
 * the window scale factor).
 */
function measure(el: HTMLElement): WebviewBounds {
  const rect = el.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const snap = (value: number) => Math.round(value * dpr) / dpr;
  return { x: snap(rect.x), y: snap(rect.y), width: snap(rect.width), height: snap(rect.height) };
}

function sameBounds(a: WebviewBounds | null, b: WebviewBounds): boolean {
  return a !== null && a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height;
}

/** Longest duration+delay of a running transition, in milliseconds. */
function transitionDeadline(target: Element): number {
  const style = getComputedStyle(target);
  const toMs = (value: string) =>
    Math.max(...value.split(",").map((part) => parseFloat(part) * (part.trim().endsWith("ms") ? 1 : 1000) || 0));
  return toMs(style.transitionDuration) + toMs(style.transitionDelay);
}

export function EmbeddedWebviewFrame({
  label,
  url,
  className,
  destroyOnUnmount = true,
}: {
  /** Unique webview label (letters, digits, '-', '_'). */
  label: string;
  url: string;
  className?: string;
  /** Destroy the native webview on unmount (default) or just hide it. */
  destroyOnUnmount?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const urlRef = useRef(url);
  const frame = useEmbeddedWebviewStore((state) => state.frames[label]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const bridge = getEmbeddedWebviewBridge();
    mountFrame(label);

    const lastSent: { bounds: WebviewBounds | null } = { bounds: null };
    let scheduled: number | null = null;
    let animationDeadline = 0;
    let animationFrame: number | null = null;

    const send = () => {
      const bounds = measure(el);
      if (sameBounds(lastSent.bounds, bounds)) return;
      lastSent.bounds = bounds;
      void bridge.setBounds(label, bounds).catch(() => undefined);
    };

    // Steady-state sync: coalesce bursts (resize + scroll in one frame) into
    // a single invoke per animation frame, skipped when bounds are unchanged.
    const scheduleSync = () => {
      if (scheduled !== null) return;
      scheduled = requestAnimationFrame(() => {
        scheduled = null;
        send();
      });
    };

    // Layout-animation sync: while a layout transition runs anywhere in the
    // document (sidebar collapse, drawer resize), follow it frame by frame.
    const animationTick = () => {
      animationFrame = null;
      send();
      if (performance.now() < animationDeadline) {
        animationFrame = requestAnimationFrame(animationTick);
      }
    };
    const onTransitionRun = (event: TransitionEvent) => {
      if (!LAYOUT_TRANSITION_PROPERTIES.has(event.propertyName)) return;
      if (!(event.target instanceof Element)) return;
      const deadline = performance.now() + transitionDeadline(event.target) + 50;
      animationDeadline = Math.max(animationDeadline, deadline);
      if (animationFrame === null) animationFrame = requestAnimationFrame(animationTick);
    };
    const onTransitionEnd = (event: TransitionEvent) => {
      if (!LAYOUT_TRANSITION_PROPERTIES.has(event.propertyName)) return;
      scheduleSync();
    };

    const initial = measure(el);
    lastSent.bounds = initial;
    void bridge.create(label, urlRef.current, initial).catch((error) => {
      console.warn(`Failed to create embedded webview ${label}:`, error);
    });

    const resizeObserver = new ResizeObserver(scheduleSync);
    resizeObserver.observe(el);
    window.addEventListener("resize", scheduleSync);
    // Capture-phase so scrolls of any scrollable ancestor re-anchor the view.
    document.addEventListener("scroll", scheduleSync, { capture: true, passive: true });
    document.addEventListener("transitionrun", onTransitionRun);
    document.addEventListener("transitionend", onTransitionEnd);
    document.addEventListener("transitioncancel", onTransitionEnd);

    // Moving between monitors changes the device pixel ratio without any
    // resize; re-listen after each change since the media query is DPR-bound.
    let dprMedia: MediaQueryList | null = null;
    const watchDpr = () => {
      dprMedia?.removeEventListener("change", onDprChange);
      dprMedia = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
      dprMedia.addEventListener("change", onDprChange);
    };
    const onDprChange = () => {
      lastSent.bounds = null;
      scheduleSync();
      watchDpr();
    };
    watchDpr();

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("resize", scheduleSync);
      document.removeEventListener("scroll", scheduleSync, { capture: true });
      document.removeEventListener("transitionrun", onTransitionRun);
      document.removeEventListener("transitionend", onTransitionEnd);
      document.removeEventListener("transitioncancel", onTransitionEnd);
      dprMedia?.removeEventListener("change", onDprChange);
      if (scheduled !== null) cancelAnimationFrame(scheduled);
      if (animationFrame !== null) cancelAnimationFrame(animationFrame);
      unmountFrame(label);
      if (destroyOnUnmount) void bridge.destroy(label).catch(() => undefined);
      else void bridge.setVisible(label, false).catch(() => undefined);
    };
    // destroyOnUnmount is read only during cleanup; remount on change is unwanted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [label]);

  // Navigate in place on url changes; creation handled the first url.
  useEffect(() => {
    if (urlRef.current === url) return;
    urlRef.current = url;
    void getEmbeddedWebviewBridge()
      .navigate(label, url)
      .catch(() => undefined);
  }, [label, url]);

  const covered = frame?.covered ?? false;
  return (
    <div ref={ref} className={cn("relative overflow-hidden bg-background", className)}>
      {covered && frame?.snapshotUrl ? (
        <img
          src={frame.snapshotUrl}
          alt=""
          aria-hidden
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-fill"
        />
      ) : null}
      {covered && !frame?.snapshotUrl ? (
        // Snapshot unavailable (unsupported platform or capture failure):
        // neutral surface in place of the page, never a blank white flash.
        <div className="absolute inset-0 bg-sidebar" />
      ) : null}
    </div>
  );
}
