"use client";

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";

export type StepsItemProps = ComponentProps<"div">;

export const StepsItem = ({
  children,
  className,
  ...props
}: StepsItemProps) => (
  <div className={cn("text-sm text-muted-foreground", className)} {...props}>
    {children}
  </div>
);

export type StepsTriggerProps = ComponentProps<
  typeof CollapsibleTrigger
> & {
  leftIcon?: ReactNode;
  swapIconOnHover?: boolean;
};

export const StepsTrigger = ({
  children,
  className,
  leftIcon,
  swapIconOnHover = true,
  ...props
}: StepsTriggerProps) => (
  <CollapsibleTrigger
    className={cn(
      "group flex w-full cursor-pointer items-center justify-start gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground",
      className
    )}
    {...props}
  >
    <div className="flex items-center gap-2">
      {leftIcon ? (
        <span className="relative inline-flex size-4 items-center justify-center">
          <span
            className={cn(
              "transition-opacity",
              swapIconOnHover && "group-hover:opacity-0"
            )}
          >
            {leftIcon}
          </span>
          {swapIconOnHover && (
            <ChevronDown size={16} className="absolute opacity-0 transition-opacity group-hover:opacity-100 group-data-[state=open]:rotate-180" />
          )}
        </span>
      ) : null}
      <span>{children}</span>
    </div>
    {!leftIcon && (
      <ChevronDown size={16} className="transition-transform group-data-[state=open]:rotate-180" />
    )}
  </CollapsibleTrigger>
);

export type StepsContentProps = ComponentProps<
  typeof CollapsibleContent
> & {
  bar?: ReactNode | false;
};

export const StepsContent = ({
  children,
  className,
  bar,
  ...props
}: StepsContentProps) => {
  return (
    <CollapsibleContent
      className={cn(
        "text-popover-foreground data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down overflow-hidden",
        className
      )}
      {...props}
    >
      <div className={cn(
        "max-w-full min-w-0",
        bar === false
          ? "block"
          : "mt-3 grid grid-cols-[min-content_minmax(0,1fr)] items-start gap-x-3"
      )}>
        {bar !== false && <div className="min-w-0 self-stretch">{bar ?? <StepsBar />}</div>}
        <div className="flex min-w-0 flex-col gap-2">{children}</div>
      </div>
    </CollapsibleContent>
  );
};

export type StepsBarProps = ComponentProps<"div">;

export const StepsBar = ({ className, ...props }: StepsBarProps) => (
  <div
    className={cn("bg-muted h-full w-[2px]", className)}
    aria-hidden
    {...props}
  />
);

export type StepsProps = ComponentProps<typeof Collapsible>;

export function Steps({ defaultOpen = true, className, ...props }: StepsProps) {
  return (
    <Collapsible
      className={cn(className)}
      defaultOpen={defaultOpen}
      {...props}
    />
  );
}
