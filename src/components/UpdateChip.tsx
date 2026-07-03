import { Spinner } from "@/components/ui/spinner";
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
          <Spinner className="size-3" />
          <span className="text-xs font-semibold text-inherit">
            {status === "installing" ? "Installing..." : `${progress}%`}
          </span>
        </>
      ) : status === "downloaded" ? (
        <span className="text-xs font-semibold text-inherit">
          Install Update
        </span>
      ) : (
        <span className="text-xs font-semibold text-inherit">
          Update failed
        </span>
      )}
    </button>
  );
}
