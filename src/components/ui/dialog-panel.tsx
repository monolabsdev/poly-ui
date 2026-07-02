import * as React from "react";
import {
  Dialog as BaseDialog,
  DialogContent as BaseDialogContent,
  DialogTitle as BaseDialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onClose?: () => void;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
  fullWidth?: boolean;
  maxWidth?: "xs" | "sm" | "md" | "lg" | "xl" | false;
  slotProps?: unknown;
};

const maxWidthClass = {
  xs: "sm:max-w-xs",
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
} as const;

export function Dialog({
  open,
  onClose,
  onOpenChange,
  children,
  fullWidth,
  maxWidth = "sm",
  slotProps: _slotProps,
}: DialogProps) {
  return (
    <BaseDialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange?.(next);
        if (!next) onClose?.();
      }}
    >
      <BaseDialogContent
        showCloseButton={false}
        className={cn(
          "max-w-[calc(100vw-32px)] rounded-[28px] bg-card p-0",
          fullWidth && "w-[calc(100vw-32px)]",
          maxWidth && maxWidthClass[maxWidth],
        )}
      >
        {children}
      </BaseDialogContent>
    </BaseDialog>
  );
}

export function DialogTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <BaseDialogTitle
      className={cn("border-b border-border/60 px-5 py-4 text-base font-semibold", className)}
      {...props}
    />
  );
}

export function DialogContent({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-5", className)} {...props} />;
}

export function DialogActions({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex justify-end gap-2 border-t border-border/60 p-4", className)}
      {...props}
    />
  );
}
