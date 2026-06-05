import { type ElementType, type HTMLAttributes } from "react";
import { Box, useTheme } from "@mui/material";

export type TextShimmerProps = {
  as?: ElementType;
  duration?: number;
  spread?: number;
  children: React.ReactNode;
} & HTMLAttributes<HTMLElement>;

export function TextShimmer({
  as = "span",
  duration = 4,
  spread = 20,
  children,
  ...props
}: TextShimmerProps) {
  const dynamicSpread = Math.min(Math.max(spread, 5), 45);
  const theme = useTheme();

  return (
    <Box
      component={as}
      className="text-shimmer"
      sx={{
        backgroundImage: `linear-gradient(to right, ${theme.palette.text.secondary} ${50 - dynamicSpread}%, ${theme.palette.text.primary} 50%, ${theme.palette.text.secondary} ${50 + dynamicSpread}%)`,
        animation: `shimmer-sweep ${duration}s infinite linear`,
        display: as === "span" ? "inline-block" : undefined,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}
