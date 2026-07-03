import React, { useEffect } from "react";
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X, Loader2 } from "lucide-react";
import { useNotificationStore, type Toast as ToastType } from "@/store/notificationStore";
import { cn } from "@/lib/utils";

const typeIcon = {
  success: CheckCircle2,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  loading: Loader2,
};

const ToastItem = ({ toast }: { toast: ToastType }) => {
  const remove = useNotificationStore((s) => s.actions.remove);
  const Icon = typeIcon[toast.type] || Info;
  const tone =
    toast.type === "success"
      ? "border-[var(--success-soft)] text-success"
      : toast.type === "error"
        ? "border-destructive/25 text-destructive"
        : toast.type === "warning"
          ? "border-[var(--warning-soft)] text-warning"
          : "border-border/60 text-muted-foreground";

  useEffect(() => {
    if (toast.duration === Infinity) return;
    const timer = setTimeout(() => remove(toast.id), toast.duration || 3000);
    return () => clearTimeout(timer);
  }, [toast.id, toast.duration, remove]);

  return (
    <div
      className={cn(
        "animate-toast-in pointer-events-auto relative mb-3 flex w-[calc(100vw-32px)] max-w-[380px] items-start gap-3.5 rounded-xl border bg-card px-4 py-3.5 shadow-xl sm:w-[380px]",
        tone,
      )}
    >
      <div className="mt-1 shrink-0 leading-none">
        <Icon size={18} className={toast.type === "loading" ? "animate-spin" : undefined} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-5 text-foreground">
          {toast.message}
        </p>
        {toast.description && (
          <p className="mt-1 block text-xs leading-[1.4] text-muted-foreground">
            {toast.description}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => remove(toast.id)}
        className="-mt-1 -mr-1 rounded-md p-1 text-muted-foreground/60 hover:bg-accent hover:text-foreground"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
};

export const NotificationProvider = ({ children }: { children: React.ReactNode }) => {
  const toasts = useNotificationStore((s) => s.toasts);

  return (
    <>
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[var(--z-toast)] flex flex-col-reverse sm:right-6 sm:bottom-6">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} />
        ))}
      </div>
    </>
  );
};
