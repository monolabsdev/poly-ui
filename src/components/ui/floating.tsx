import * as React from "react";
import { cn } from "@/lib/utils";

type FloatingProps = React.HTMLAttributes<HTMLDivElement> & {
  open?: boolean;
  anchorEl?: HTMLElement | null;
};

function getAnchorStyle(anchorEl?: HTMLElement | null): React.CSSProperties {
  if (!anchorEl) return {};
  const rect = anchorEl.getBoundingClientRect();
  return {
    top: rect.bottom + 4,
    left: rect.left,
    minWidth: rect.width,
  };
}

export function Popover({
  open,
  anchorEl,
  children,
  className,
  transitionDuration: _transitionDuration,
  slotProps: _slotProps,
  ...props
}: FloatingProps & {
  onClose?: () => void;
  anchorOrigin?: unknown;
  transformOrigin?: unknown;
  transitionDuration?: unknown;
  slotProps?: unknown;
}) {
  if (!open) return null;
  return (
    <div
      className={cn("fixed z-[var(--z-popover)] rounded-lg border border-border/60 bg-popover text-popover-foreground shadow-md", className)}
      style={getAnchorStyle(anchorEl)}
      {...props}
    >
      {children}
    </div>
  );
}

export function Popper({
  open = true,
  anchorEl,
  children,
  className,
  ...props
}: FloatingProps & { placement?: string }) {
  if (!open) return null;
  return (
    <div
      className={cn("fixed z-[var(--z-popover)]", className)}
      style={getAnchorStyle(anchorEl)}
      {...props}
    >
      {children}
    </div>
  );
}
