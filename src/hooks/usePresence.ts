import { useEffect, useRef, useState } from "react";

export type PresenceState = "open" | "closed";

export function usePresence(open: boolean, exitMs = 150) {
  const [mounted, setMounted] = useState(open);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }

    if (open) {
      setMounted(true);
    } else if (mounted) {
      timer.current = setTimeout(() => setMounted(false), exitMs);
    }

    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [open, exitMs, mounted]);

  return { mounted, state: (open ? "open" : "closed") as PresenceState };
}
