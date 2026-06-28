import * as React from "react";
import MuiAvatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import type { SxProps, Theme } from "@mui/material/styles";

export const AVATAR_COLOR_PALETTE = [
  "#c2410c",
  "#2563eb",
  "#4b5563",
  "#15803d",
  "#9333ea",
  "#be123c",
] as const;

type AvatarColor = (typeof AVATAR_COLOR_PALETTE)[number];

function sxArray(sx?: SxProps<Theme>) {
  if (!sx) return [];
  return Array.isArray(sx) ? sx : [sx];
}

export function getAvatarColor(seed: string): AvatarColor {
  const normalizedSeed = seed.trim() || "?";
  let hash = 0;

  for (const char of normalizedSeed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  return AVATAR_COLOR_PALETTE[hash % AVATAR_COLOR_PALETTE.length];
}

export function getAvatarColorSeed(children: React.ReactNode): string {
  let seed = "";

  React.Children.forEach(children, (child) => {
    if (seed) return;

    if (typeof child === "string" || typeof child === "number") {
      seed = String(child);
      return;
    }

    if (React.isValidElement<{ children?: React.ReactNode }>(child)) {
      seed = getAvatarColorSeed(child.props.children);
    }
  });

  return seed;
}

function Avatar({
  className,
  children,
  sx,
  ...props
}: {
  className?: string;
  children?: React.ReactNode;
} & React.ComponentProps<typeof Box>) {
  const avatarColor = getAvatarColor(getAvatarColorSeed(children));

  return (
    <MuiAvatar
      component={Box}
      className={className}
      sx={[
        {
          width: 32,
          height: 32,
          fontSize: "0.875rem",
          bgcolor: avatarColor,
          color: "common.white",
          border: "1px solid",
          borderColor: "divider",
        },
        ...sxArray(sx),
      ]}
      {...props}
    >
      {children}
    </MuiAvatar>
  );
}

function AvatarImage({ src, alt, className }: { src?: string; alt?: string; className?: string }) {
  return (
    <Box
      component="img"
      src={src}
      alt={alt}
      className={className}
      sx={{ aspectRatio: "1", width: "100%", height: "100%", borderRadius: "9999px", objectFit: "cover" }}
    />
  );
}

function AvatarFallback({
  className,
  children,
  sx,
  ...props
}: {
  className?: string;
  children: React.ReactNode;
} & React.ComponentProps<typeof Box>) {
  return (
    <Box
      className={className}
      sx={[
        {
          display: "flex",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "9999px",
          fontSize: "0.875rem",
        },
        ...sxArray(sx),
        {
          bgcolor: "inherit",
          color: "inherit",
        },
      ]}
      {...props}
    >
      {children}
    </Box>
  );
}

export {
  Avatar,
  AvatarImage,
  AvatarFallback,
};
