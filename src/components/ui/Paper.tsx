import * as React from "react";
import { cn } from "@/lib/utils";

export function Paper({
  className,
  variant: _variant,
  elevation: _elevation,
  ...props
}: React.ComponentPropsWithoutRef<"div"> & { variant?: string; elevation?: number }) {
  return (
    <div
      className={cn("rounded-lg border bg-card text-card-foreground", className)}
      {...props}
    />
  );
}
