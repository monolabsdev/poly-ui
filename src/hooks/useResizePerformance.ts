import { useEffect, useRef, useSyncExternalStore, type RefObject } from "react";

const RESIZE_IDLE_MS = 140;
const RESIZE_EVENT = "openbench-resize-active";
let isResizeActive = false;

function setResizeActive(next: boolean) {
  if (isResizeActive === next) return;
  isResizeActive = next;
  window.dispatchEvent(new Event(RESIZE_EVENT));
}

type Size = {
  width: number;
  height: number;
};

export function useResizeActivity(targetRef: RefObject<Element | null>) {
  const frameRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const lastSizeRef = useRef<Size>({ width: 0, height: 0 });

  useEffect(() => {
    const target = targetRef.current;
    if (!target || typeof ResizeObserver === "undefined") return;

    const clearResizeClass = () => {
      idleTimerRef.current = null;
      document.documentElement.classList.remove("app-resizing");
      setResizeActive(false);
    };

    const markResizing = () => {
      document.documentElement.classList.add("app-resizing");
      setResizeActive(true);
      if (idleTimerRef.current !== null) {
        window.clearTimeout(idleTimerRef.current);
      }
      idleTimerRef.current = window.setTimeout(clearResizeClass, RESIZE_IDLE_MS);
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      if (frameRef.current !== null) return;

      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const { width, height } = entry.contentRect;
        const last = lastSizeRef.current;
        if (Math.abs(width - last.width) < 1 && Math.abs(height - last.height) < 1) {
          return;
        }
        lastSizeRef.current = { width, height };
        markResizing();
      });
    });

    observer.observe(target);
    return () => {
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (idleTimerRef.current !== null) window.clearTimeout(idleTimerRef.current);
      document.documentElement.classList.remove("app-resizing");
      setResizeActive(false);
    };
  }, [targetRef]);
}

export function useIsResizeActive() {
  return useSyncExternalStore(
    (onStoreChange) => {
      window.addEventListener(RESIZE_EVENT, onStoreChange);
      return () => window.removeEventListener(RESIZE_EVENT, onStoreChange);
    },
    () => isResizeActive,
    () => false,
  );
}

export function useElementBreakpoint(
  targetRef: RefObject<Element | null>,
  breakpointPx: number,
  onChange: (matches: boolean) => void,
) {
  const frameRef = useRef<number | null>(null);
  const lastValueRef = useRef<boolean | null>(null);

  useEffect(() => {
    const target = targetRef.current;
    if (!target || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry || frameRef.current !== null) return;

      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;
        const matches = entry.contentRect.width < breakpointPx;
        if (matches === lastValueRef.current) return;
        lastValueRef.current = matches;
        onChange(matches);
      });
    });

    observer.observe(target);
    return () => {
      observer.disconnect();
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
  }, [breakpointPx, onChange, targetRef]);
}
