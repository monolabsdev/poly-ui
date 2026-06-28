import * as React from "react";
import { Box, type BoxProps } from "@/components/ui/Box";
import { cn } from "@/lib/utils";

type StackProps<T extends React.ElementType = "div"> = Omit<
  BoxProps<T>,
  "display" | "flex" | "flexDirection" | "gap"
> & {
  direction?: "row" | "column" | { xs?: "row" | "column"; sm?: "row" | "column" };
  spacing?: BoxProps["gap"];
};

export function Stack<T extends React.ElementType = "div">({
  direction = "column",
  spacing = 1,
  className,
  ...props
}: StackProps<T>) {
  const resolvedDirection = typeof direction === "object" ? (direction.xs ?? direction.sm ?? "column") : direction;
  return (
    <Box
      display="flex"
      flexDirection={resolvedDirection}
      gap={spacing}
      className={cn("min-w-0", className)}
      {...props}
    />
  );
}
