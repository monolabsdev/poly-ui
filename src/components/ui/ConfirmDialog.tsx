import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./dialog";
import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  destructive?: boolean;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  destructive,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex w-[min(400px,calc(100vw-32px))] max-w-none flex-col gap-3 rounded-[28px] border border-border/60 bg-card/95 p-6 text-card-foreground backdrop-blur-xl">
        <DialogTitle className="text-[17px] font-medium leading-[1.3]">
          {title}
        </DialogTitle>

        {description ? (
          <DialogDescription className="text-[13px] font-normal leading-5 text-muted-foreground">
            {description}
          </DialogDescription>
        ) : null}

        <div className="mt-1 flex gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            className="h-9 flex-1 rounded-full text-[13px] font-medium"
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            onClick={() => { onConfirm(); onOpenChange(false); }}
            className="h-9 flex-1 rounded-full text-[13px] font-medium"
          >
            {confirmLabel}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
