import {
  Children,
  cloneElement,
  isValidElement,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";


/* ─── ChainOfThought ─── */

export type ChainOfThoughtProps = {
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

export function ChainOfThought({ children, ...props }: ChainOfThoughtProps) {
  const array = Children.toArray(children);
  return (
    <div {...props}>
      {array.map((child, i) =>
        isValidElement(child)
          ? cloneElement(child as React.ReactElement<ChainOfThoughtStepProps>, {
              isLast: i === array.length - 1,
            })
          : child,
      )}
    </div>
  );
}

/* ─── ChainOfThoughtStep ─── */

export type ChainOfThoughtStepProps = {
  children: ReactNode;
  isActive?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  isLast?: boolean;
};

export function ChainOfThoughtStep({
  children,
  isActive = false,
  isExpanded = false,
  onToggle,
  isLast = false,
}: ChainOfThoughtStepProps) {
  let trigger: ReactNode = null;
  let content: ReactNode = null;

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === ChainOfThoughtTrigger) {
      trigger = child;
    } else if (child.type === ChainOfThoughtContent) {
      content = child;
    }
  });

  return (
    <div className={cn("flex gap-3", !isLast && "mb-1")}>
      {/* Timeline column */}
      <div className="flex w-4 shrink-0 flex-col items-center">
        <div
          className={cn(
            "mt-1.5 size-2 shrink-0 rounded-full transition-colors duration-[var(--dur-base)] ease-[var(--ease-soft)]",
            isActive ? "bg-foreground" : "bg-border",
          )}
        />
        {!isLast && (
          <div className="mt-1 min-h-4 w-px flex-1 bg-border" />
        )}
      </div>

      {/* Content column */}
      <div className={cn("min-w-0 flex-1", !isLast && "pb-2")}>
        {trigger &&
          isValidElement(trigger) &&
          cloneElement(trigger as React.ReactElement<ChainOfThoughtTriggerProps>, {
            isActive,
            isExpanded,
            onToggle,
          })}
        {content && isExpanded && (
          <div className="terax-reveal mt-2 ml-0.5 border-l border-border/60 pl-3" data-state="open">
            <div>{content}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── ChainOfThoughtTrigger ─── */

export type ChainOfThoughtTriggerProps = {
  children: ReactNode;
  icon?: ReactNode;
  isActive?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
};

export function ChainOfThoughtTrigger({
  children,
  icon,
  isActive = false,
  onToggle,
}: ChainOfThoughtTriggerProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={isActive}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full bg-transparent p-0 font-inherit text-[13px] font-medium text-muted-foreground transition-colors duration-[var(--dur-fast)] ease-[var(--ease-soft)] focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground",
        isActive ? "cursor-default" : "cursor-pointer hover:text-foreground",
      )}
    >
      {icon && (
        <span className="flex shrink-0 items-center text-muted-foreground">
          {icon}
        </span>
      )}
      {isActive ? (
        <span className="animate-thinking inline">
          {children}
        </span>
      ) : (
        children
      )}
      {!isActive && (
        <span className="flex shrink-0 items-center text-muted-foreground/55 transition-transform duration-[var(--dur-base)] ease-[var(--ease-premium)]">
          <ChevronDown size={13} />
        </span>
      )}
    </button>
  );
}

/* ─── ChainOfThoughtContent ─── */

export type ChainOfThoughtContentProps = {
  children: ReactNode;
};

export function ChainOfThoughtContent({ children }: ChainOfThoughtContentProps) {
  return <>{children}</>;
}
