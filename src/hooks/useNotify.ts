import { useNotificationStore, type ToastType } from "@/store/notificationStore";
import { useCallback } from "react";

export function useNotify() {
  const { add, remove, update } = useNotificationStore((s) => s.actions);

  const notify = useCallback(
    (message: string, type: ToastType = "info", options?: { description?: string; duration?: number }) => {
      return add({ message, type, ...options });
    },
    [add]
  );

  const success = useCallback((msg: string, desc?: string) => add({ message: msg, description: desc, type: "success" }), [add]);
  const error = useCallback((msg: string, desc?: string) => add({ message: msg, description: desc, type: "error", duration: 5000 }), [add]);
  const warn = useCallback((msg: string, desc?: string) => add({ message: msg, description: desc, type: "warning" }), [add]);
  const info = useCallback((msg: string, desc?: string) => add({ message: msg, description: desc, type: "info" }), [add]);

  const promise = useCallback(
    async <T>(
      p: Promise<T>,
      msgs: { loading: string; success: string | ((data: T) => string); error: string | ((err: any) => string) }
    ): Promise<T> => {
      const id = add({ message: msgs.loading, type: "loading", duration: Infinity });
      try {
        const result = await p;
        const successMsg = typeof msgs.success === "function" ? msgs.success(result) : msgs.success;
        update(id, { message: successMsg, type: "success", duration: 3000 });
        return result;
      } catch (err) {
        const errorMsg = typeof msgs.error === "function" ? msgs.error(err) : msgs.error;
        update(id, { message: errorMsg, type: "error", duration: 5000 });
        throw err;
      }
    },
    [add, update]
  );

  return { notify, success, error, warn, info, promise, dismiss: remove };
}
