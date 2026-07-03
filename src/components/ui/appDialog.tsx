// Design: Quiet instrument panel — fixed-width shell, soft contrast, precise spacing.
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import type { ReactNode } from "react";

export const APP_DIALOG_WIDTH = 920;
export const APP_DIALOG_CONTENT_WIDTH = 600;
export const APP_DIALOG_SIDEBAR_WIDTH = 244;

type AppDialogFrameProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

export function AppDialogFrame({
  open,
  onOpenChange,
  children,
}: AppDialogFrameProps) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      maxWidth={APP_DIALOG_WIDTH}
      showCloseButton={false}
      className="h-[calc(100dvh_-_var(--titlebar-height))] w-screen rounded-none border-border/60 bg-card shadow-2xl outline-none sm:h-[min(680px,calc(100dvh_-_var(--titlebar-height)_-_48px))] sm:w-[min(920px,calc(100vw_-_32px))] sm:rounded-[min(var(--radius-4xl),24px)]"
      contentClassName="p-0"
    >
      {children}
    </Modal>
  );
}

type AppDialogHeaderProps = {
  id?: string;
  title: string;
  onClose: () => void;
  closeClassName?: string;
};

export function AppDialogHeader({
  id,
  title,
  onClose,
  closeClassName,
}: AppDialogHeaderProps) {
  return (
    <header className="flex min-h-14 shrink-0 items-center justify-between px-4 md:px-6">
      <div>
        <h2 id={id} className="ml-2 text-base font-bold">
          {title}
        </h2>
      </div>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onClose}
        aria-label="Close dialog"
        className={cn("size-8 text-muted-foreground hover:bg-accent hover:text-foreground", closeClassName)}
      >
        <X size={20} />
      </Button>
    </header>
  );
}

export function AppDialogBody({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-0 flex-1 justify-center overflow-y-auto px-4 py-5 md:px-6">
      <div className="min-w-0 w-full sm:max-w-[600px]">
        {children}
      </div>
    </main>
  );
}

export const appPanelClassName = "rounded-lg bg-transparent transition-colors duration-[var(--dur-fast)] ease-[var(--ease-soft)]";
export const appInputClassName = "rounded-lg border-0 bg-transparent text-sm";
export const appFadeInClassName = "animate-[app-dialog-fade_var(--dur-fast)_var(--ease-premium)]";
