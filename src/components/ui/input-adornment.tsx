import * as React from "react";
import { cn } from "@/lib/utils";

export function InputAdornment({
  className,
  position: _position,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { position?: "start" | "end" }) {
  return (
    <span
      className={cn("inline-flex items-center text-muted-foreground", className)}
      {...props}
    />
  );
}
