import {
  useEffect,
  useRef,
  useSyncExternalStore,
  type RefObject,
  useCallback,
} from "react";

const RESIZE_IDLE_MS = 140;

/* ─────────────────────────────────────────────
   Internal shared store (module-scoped but safe)
──────────────────────────────────────────── */
type Listener = () => void;

class ResizeActivityStore {
  private value = false;
  private listeners = new Set<Listener>();

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.value;

  setValue(next: boolean) {
    if (this.value === next) return;
    this.value = next;
    this.listeners.forEach((l) => l());
  }
}

const store = new ResizeActivityStore();

/* ─────────────────────────────────────────────
   Hook: detect resize activity on an element
──────────────────────────────────────────── */
export function useResizeActivity(
  targetRef: RefObject<Element | null>,
  idleMs = RESIZE_IDLE_MS,
) {
  const frameRef = useRef<number | null>(null);
  const idleTimerRef = useRef<number | null>(null);
  const lastSizeRef = useRef({ width: 0, height: 0 });

  const setIdle = useCallback(() => {
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

    idleTimerRef.current = window.setTimeout(() => {
      store.setValue(false);
    }, idleMs);
  }, [idleMs]);

  useEffect(() => {
    const el = targetRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const markActive = () => {
      store.setValue(true);
      setIdle();
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      if (frameRef.current !== null) return;

      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;

        const { width, height } = entry.contentRect;
        const last = lastSizeRef.current;

        // ignore micro jitter
        if (
          Math.abs(width - last.width) < 1 &&
          Math.abs(height - last.height) < 1
        ) {
          return;
        }

        lastSizeRef.current = { width, height };
        markActive();
      });
    });

    observer.observe(el);

    return () => {
      observer.disconnect();

      if (frameRef.current) cancelAnimationFrame(frameRef.current);
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);

      store.setValue(false);
    };
  }, [targetRef, setIdle]);
}

/* ─────────────────────────────────────────────
   Hook: read resize activity state
──────────────────────────────────────────── */
export function useIsResizeActive() {
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => false);
}

/* ─────────────────────────────────────────────
   Hook: element breakpoint detector (stable)
──────────────────────────────────────────── */
export function useElementBreakpoint(
  targetRef: RefObject<Element | null>,
  breakpointPx: number,
  onChange: (matches: boolean) => void,
) {
  const frameRef = useRef<number | null>(null);
  const lastValueRef = useRef<boolean | null>(null);

  useEffect(() => {
    const el = targetRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      if (frameRef.current !== null) return;

      frameRef.current = requestAnimationFrame(() => {
        frameRef.current = null;

        const matches = entry.contentRect.width < breakpointPx;

        if (matches === lastValueRef.current) return;

        lastValueRef.current = matches;
        onChange(matches);
      });
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [targetRef, breakpointPx, onChange]);
}
