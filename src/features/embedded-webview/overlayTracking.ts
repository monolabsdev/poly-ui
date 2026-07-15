import { useCallback, useEffect, useRef } from "react";
import { notifyOverlayClosed, notifyOverlayOpened } from "./embeddedWebviewStore";

/**
 * Central wiring between overlay-capable UI and the embedded webview
 * overlay-hide mechanism (see embeddedWebviewStore). Every UI surface that
 * can overlap an embedded webview reports open/close here; the store counts
 * open overlays and swaps native webviews for snapshots while any are up.
 *
 * Wired once into the shared primitives (dialog, popover, dropdown-menu,
 * select, context-menu, sheet, drawer, modal-root, toasts) so individual call
 * sites need no changes. Tooltips and hover-cards are deliberately not
 * tracked: they open on every hover and would thrash the snapshot cycle.
 */

type OverlayRootProps = {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
};

function useOverlayReporter(): (open: boolean) => void {
  const wasOpen = useRef(false);
  const report = useCallback((open: boolean) => {
    if (open === wasOpen.current) return;
    wasOpen.current = open;
    if (open) notifyOverlayOpened();
    else notifyOverlayClosed();
  }, []);
  // Unmounting while open (dialog removed from the tree, toast list cleared
  // by a route change) must release its overlay slot.
  useEffect(() => () => report(false), [report]);
  return report;
}

/**
 * Track a boolean open state (custom overlays: ModalRoot, toast stack).
 */
export function useOverlayOpenTracking(open: boolean): void {
  const report = useOverlayReporter();
  useEffect(() => {
    report(open);
  }, [open, report]);
}

/**
 * Wrap a Radix Root's props so open/close is tracked for controlled and
 * uncontrolled usage alike. Spread the result onto the primitive Root.
 */
export function useOverlayRootProps<P extends OverlayRootProps>(props: P): P {
  const report = useOverlayReporter();
  const { open, defaultOpen, onOpenChange } = props;

  useEffect(() => {
    // Controlled roots may change `open` without an interaction (parent
    // setState); uncontrolled roots that start open never fire onOpenChange.
    if (open !== undefined) report(open);
    else if (defaultOpen) report(true);
  }, [open, defaultOpen, report]);

  return {
    ...props,
    onOpenChange: (next: boolean) => {
      report(next);
      onOpenChange?.(next);
    },
  };
}
