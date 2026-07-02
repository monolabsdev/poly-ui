import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface ModalProps {
  children: React.ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  maxWidth?: number | string;
  height?: number | string;
  showCloseButton?: boolean;
  headerAction?: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

export function Modal({
  children,
  open,
  onOpenChange,
  title,
  description,
  maxWidth = 500,
  height,
  showCloseButton = true,
  headerAction,
  footer,
  className,
  contentClassName,
}: ModalProps) {
  const width =
    typeof maxWidth === "number"
      ? `min(${maxWidth}px, calc(100vw - 32px))`
      : `min(${maxWidth}, calc(100vw - 32px))`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "flex max-w-none grid-cols-none flex-col gap-0 overflow-hidden rounded-[min(var(--radius-4xl),24px)] border-border/60 bg-card p-0 shadow-2xl",
          className,
        )}
        style={{ width, maxWidth, height, maxHeight: "calc(100vh - var(--titlebar-height) - 32px)" }}
      >
        {(title || description || showCloseButton || headerAction) && (
          <DialogHeader className="flex shrink-0 flex-row items-center justify-between border-b border-border/60 p-4">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              {title && (
                <DialogTitle className="text-base font-semibold text-foreground">
                  {title}
                </DialogTitle>
              )}
              {description && (
                <DialogDescription className="p-0 text-sm text-muted-foreground">
                  {description}
                </DialogDescription>
              )}
            </div>

            <div className="flex items-center gap-2">
              {headerAction}
              {showCloseButton && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => onOpenChange(false)}
                  aria-label="Close modal"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X size={18} />
                </Button>
              )}
            </div>
          </DialogHeader>
        )}

        <div className={cn("min-h-0 flex-1 overflow-y-auto", contentClassName)}>
          {children}
        </div>

        {footer && (
          <div className="shrink-0 border-t border-border/60 p-4">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
