import { Ring2 } from "ldrs/react";
import "ldrs/react/Ring2.css";
import { useUpdateStore } from "@/store/updateStore";

export function UpdateChip() {
  const status = useUpdateStore((s) => s.status);
  const progress = useUpdateStore((s) => s.progress);
  const install = useUpdateStore((s) => s.actions.install);

  if (status === "idle" || status === "checking" || status === "available") return null;

  const isBusy = status === "downloading" || status === "installing";

  return (
    <button
      type="button"
      onClick={isBusy ? undefined : install}
      onMouseDown={(e: React.MouseEvent) => e.stopPropagation()}
      onDoubleClick={(e: React.MouseEvent) => e.stopPropagation()}
      className={`inline-flex select-none items-center gap-2 whitespace-nowrap rounded-full px-3 py-0.5 text-xs font-semibold text-primary-foreground ${
        status === "error" ? "bg-destructive" : "bg-primary"
      } ${isBusy ? "cursor-default" : "cursor-pointer hover:opacity-85"}`}
    >
      {isBusy ? (
        <>
          <Ring2
            size="12"
            stroke="3"
            strokeLength="0.28"
            bgOpacity="0.2"
            speed="0.8"
            color="currentColor"
          />
          <span className="text-[11px] font-semibold text-inherit">
            {status === "installing" ? "Installing..." : `${progress}%`}
          </span>
        </>
      ) : status === "downloaded" ? (
        <span className="text-[11px] font-semibold text-inherit">
          Install Update
        </span>
      ) : (
        <span className="text-[11px] font-semibold text-inherit">
          Update failed
        </span>
      )}
    </button>
  );
}
