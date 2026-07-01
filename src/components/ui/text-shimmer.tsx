import type * as React from "react"

import { cn } from "@/lib/utils"

export type TextShimmerProps = {
  as?: string
  duration?: number
  spread?: number
  children: React.ReactNode
} & React.HTMLAttributes<HTMLElement>

export function TextShimmer({
  as = "span",
  className,
  duration = 4,
  spread = 20,
  children,
  style,
  ...props
}: TextShimmerProps) {
  const dynamicSpread = Math.min(Math.max(spread, 5), 45)
  const Component = as as React.ElementType

  return (
    <Component
      className={cn(
        "poly-shimmer bg-clip-text font-medium text-transparent",
        className
      )}
      style={{
        "--shimmer-duration": `${duration}s`,
        "--shimmer-spread": `${dynamicSpread}%`,
        ...style,
      } as React.CSSProperties}
      {...props}
    >
      {children}
    </Component>
  )
}
