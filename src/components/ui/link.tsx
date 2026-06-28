import * as React from "react";
import { cn } from "@/lib/utils";

type LinkProps = React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  as?: React.ElementType;
  underline?: "none" | "hover" | "always";
  variant?: string;
};

export const Link = React.forwardRef<HTMLAnchorElement, LinkProps>(function Link({
  as,
  className,
  underline = "hover",
  variant: _variant,
  ...props
}, ref) {
  const Component = (as ?? "a") as React.ElementType;
  return (
    <Component
      ref={ref}
      className={cn(
        "text-primary underline-offset-4",
        underline === "always" && "underline",
        underline === "hover" && "hover:underline",
        className,
      )}
      {...props}
    />
  );
});
