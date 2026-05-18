import * as React from "react";
import { Avatar as MuiAvatar, Box } from "@mui/material";

function Avatar({
  className,
  children,
  ...props
}: {
  className?: string;
  children?: React.ReactNode;
} & React.ComponentProps<typeof Box>) {
  return (
    <MuiAvatar
      component={Box}
      className={className}
      sx={{
        width: 32,
        height: 32,
        fontSize: "0.875rem",
        bgcolor: "action.selected",
        color: "text.secondary",
        border: "1px solid",
        borderColor: "divider",
      }}
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
  ...props
}: {
  className?: string;
  children: React.ReactNode;
} & React.ComponentProps<typeof Box>) {
  return (
    <Box
      className={className}
      sx={{
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "9999px",
        fontSize: "0.875rem",
      }}
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
