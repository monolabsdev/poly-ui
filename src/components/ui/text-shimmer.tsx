import { useInsertionEffect, useRef, type ElementType, type HTMLAttributes } from "react";
import { Box, useTheme } from "@mui/material";
import { keyframes } from "@mui/material/styles";

const shimmer = keyframes`
  from { background-position: 200% center; }
  to { background-position: -200% center; }
`;

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
  const injected = useRef(false);

  useInsertionEffect(() => {
    if (injected.current) return;
    injected.current = true;
    const el = document.createElement("style");
    el.textContent = shimmer.styles;
    document.head.appendChild(el);
  }, []);

  return (
    <Box
      component={as}
      sx={{
        backgroundClip: "text",
        WebkitBackgroundClip: "text",
        WebkitTextFillColor: "transparent",
        color: "transparent",
        backgroundSize: "200% auto",
        backgroundImage: `linear-gradient(to right, ${theme.palette.text.secondary} ${50 - dynamicSpread}%, ${theme.palette.text.primary} 50%, ${theme.palette.text.secondary} ${50 + dynamicSpread}%)`,
        animation: `${shimmer.name} ${duration}s infinite linear`,
        fontWeight: 500,
        display: as === "span" ? "inline-block" : undefined,
      }}
      {...props}
    >
      {children}
    </Box>
  );
}
