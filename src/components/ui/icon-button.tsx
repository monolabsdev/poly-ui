import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type IconButtonProps = Omit<React.ComponentProps<typeof Button>, "variant" | "size"> & {
  size?: "small" | "medium" | "large";
  edge?: false | "start" | "end";
};

export function IconButton({
  className,
  size = "medium",
  edge: _edge,
  ...props
}: IconButtonProps) {
  const buttonSize = size === "small" ? "icon-sm" : size === "large" ? "icon-lg" : "icon";
  return (
    <Button
      type="button"
      variant="ghost"
      size={buttonSize}
      className={cn("shrink-0 text-muted-foreground hover:text-foreground", className)}
      {...props}
    />
  );
}
