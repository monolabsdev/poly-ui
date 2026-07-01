import * as React from "react";
import { cn } from "@/lib/utils";

export function Collapse({
  in: open,
  children,
  className,
  unmountOnExit,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  in?: boolean;
  timeout?: number | "auto";
  unmountOnExit?: boolean;
}) {
  if (!open && unmountOnExit) return null;
  return (
    <div
      className={cn(
        "poly-reveal",
        className,
      )}
      data-state={open ? "open" : "closed"}
      {...props}
    >
      <div>{children}</div>
    </div>
  );
}

export function Fade({
  in: open,
  children,
}: {
  in?: boolean;
  children: React.ReactElement<{ className?: string }>;
  timeout?: number;
}) {
  const child = children as React.ReactElement<{ className?: string }>;
  return React.cloneElement(child, {
    className: cn(
      child.props.className,
      "transition-opacity duration-[var(--dur-base)] ease-[var(--ease-premium)]",
      open ? "opacity-100" : "pointer-events-none opacity-0",
    ),
  });
}
