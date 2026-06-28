import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export const sidebarIconButtonClassName =
  "size-8 min-w-8 rounded-full bg-transparent p-0 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground active:bg-muted";

export function SidebarSectionHeader({
  label,
  action,
  disclosure,
}: {
  label: string;
  action?: React.ReactNode;
  disclosure?: {
    expanded: boolean;
    onToggle: () => void;
    controlsId: string;
  };
}) {
  return (
    <div className="flex min-h-7 items-center justify-between">
      {disclosure ? (
        <button
          type="button"
          aria-expanded={disclosure.expanded}
          aria-controls={disclosure.controlsId}
          onClick={disclosure.onToggle}
          className="flex h-7 min-w-0 items-center gap-1 rounded-lg pr-2 text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <span
            className={cn(
              "flex size-4 items-center justify-center transition-transform duration-[var(--dur-base)] ease-[var(--ease-premium)] [&>svg]:size-3.5",
              disclosure.expanded && "rotate-90",
            )}
          >
            <ChevronRight />
          </span>
          <span className="text-xs font-medium uppercase leading-[1.2]">
            {label}
          </span>
        </button>
      ) : (
        <span className="text-xs font-medium uppercase leading-[1.2] text-muted-foreground">
          {label}
        </span>
      )}
      {action}
    </div>
  );
}
