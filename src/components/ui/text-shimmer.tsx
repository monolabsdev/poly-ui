import { type CSSProperties, type ElementType, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type TextShimmerProps = {
  as?: ElementType;
  duration?: number;
  spread?: number;
  children: ReactNode;
} & HTMLAttributes<HTMLElement>;

export function TextShimmer({
  as = "span",
  duration = 4,
  spread = 20,
  children,
  className,
  style,
  ...props
}: TextShimmerProps) {
  const dynamicSpread = Math.min(Math.max(spread, 5), 45);
  const Component = as;

  return (
    <Component
      className={cn(
        "terax-shimmer font-medium text-transparent [background-clip:text] [-webkit-background-clip:text] [-webkit-box-decoration-break:clone] [-webkit-text-fill-color:transparent]",
        as === "span" && "inline",
        className,
      )}
      style={{
        "--shimmer-duration": `${duration}s`,
        "--shimmer-spread": `${dynamicSpread}%`,
        whiteSpace: "inherit",
        overflow: "inherit",
        textOverflow: "inherit",
        ...style,
      } as CSSProperties}
      {...props}
    >
      {children}
    </Component>
  );
}
