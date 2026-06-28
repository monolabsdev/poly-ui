import * as React from "react";
import MuiModal from "@mui/material/Modal";
import Box from "@mui/material/Box";
import { SxProps } from "@mui/material/styles";
import { Theme } from "@mui/material/styles";

export function Dialog({
  children,
  open,
  onOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <MuiModal
      open={open || false}
      onClose={() => onOpenChange?.(false)}
      slotProps={{
        backdrop: {
          sx: { top: "var(--titlebar-height)" },
        },
      }}
    >
      <Box
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onOpenChange?.(false);
        }}
        sx={{
          position: "fixed",
          inset: "var(--titlebar-height) 0 0 0",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          p: { xs: 0, sm: 2 },
          outline: "none",
        }}
      >
        {children}
      </Box>
    </MuiModal>
  );
}

export function DialogContent({
  children,
  className,
  sx,
}: {
  children: React.ReactNode;
  showCloseButton?: boolean;
  className?: string;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box
      className={className}
      sx={{
        bgcolor: "background.sidebar",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: (theme) => (theme as any).app?.radius?.dialog ?? "20px",
        boxSizing: "border-box",
        overflow: "hidden",
        position: "relative",
        ...sx as any,
      }}
    >
      {children}
    </Box>
  );
}

export function DialogTitle({ 
  children,
  className,
  sx,
}: { 
  children: React.ReactNode;
  className?: string;
  sx?: SxProps<Theme>;
}) {
  return <Box className={className} sx={sx}>{children}</Box>;
}

export function DialogHeader({ 
  children,
  className,
  sx,
}: { 
  children: React.ReactNode;
  className?: string;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box 
      className={className} 
      sx={{ 
        p: 2, 
        pb: 1,
        ...sx as any
      }}
    >
      {children}
    </Box>
  );
}

export function DialogDescription({ 
  children,
  className,
  sx,
}: { 
  children: React.ReactNode;
  className?: string;
  sx?: SxProps<Theme>;
}) {
  return (
    <Box 
      className={className} 
      sx={{ 
        p: 2, 
        pt: 0, 
        color: "text.secondary", 
        fontSize: "14px",
        ...sx as any
      }}
    >
      {children}
    </Box>
  );
}

export function DialogClose({
  children,
  render,
}: {
  children?: React.ReactNode;
  render?: React.ReactElement<any>;
}) {
  if (render) {
    return React.cloneElement(render, {
      onClick: (e: React.MouseEvent) => {
        render.props.onClick?.(e);
      },
      children: children || render.props.children,
    });
  }
  return <>{children}</>;
}
