import * as React from "react";
import { useOverlayOpenTracking } from "@/features/embedded-webview/overlayTracking";

export function ModalRoot({
  open,
  onClose,
  children,
  ...rest
}: {
  open: boolean;
  onClose?: () => void;
  children: React.ReactNode;
  slotProps?: unknown;
} & Omit<React.ComponentProps<"div">, "ref">) {
  const [visible, setVisible] = React.useState(open);
  const [phase, setPhase] = React.useState<"idle" | "entering" | "exiting">("idle");
  const contentRef = React.useRef<HTMLDivElement>(null);
  // Track `visible` (not `open`) so embedded webviews stay hidden until the
  // exit animation finishes — the native view would pop over the fading
  // backdrop otherwise.
  useOverlayOpenTracking(visible);

  React.useEffect(() => {
    if (open && !visible) {
      setVisible(true);
      setPhase("entering");
    } else if (!open && visible) {
      setPhase("exiting");
    }
  }, [open, visible]);

  const handleBackdropAnimEnd = React.useCallback(() => {
    if (phase === "exiting") {
      setVisible(false);
      setPhase("idle");
    } else if (phase === "entering") {
      setPhase("idle");
    }
  }, [phase]);

  React.useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handleKey);
    contentRef.current?.focus();
    return () => document.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  if (!visible) return null;

  const backdropAnim =
    phase === "entering"
      ? "animate-in fade-in-0"
      : phase === "exiting"
        ? "animate-out fade-out-0"
        : "";

  const contentAnim =
    phase === "entering"
      ? "animate-in fade-in-0 zoom-in-95"
      : phase === "exiting"
        ? "animate-out fade-out-0 zoom-out-95"
        : "";

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-background/70 duration-[var(--dur-fast)] ease-[var(--ease-premium)] ${backdropAnim}`}
      onAnimationEnd={handleBackdropAnimEnd}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
      {...rest}
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        className={`duration-[var(--dur-fast)] ease-[var(--ease-premium)] outline-none ${contentAnim}`}
      >
        {children}
      </div>
    </div>
  );
}
