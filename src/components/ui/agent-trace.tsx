import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ChevronDown, Check, Circle, AlertTriangle, LoaderCircle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepStatus = "pending" | "running" | "complete" | "error" | "waiting";

/* ─── Context ─── */

type StepCtxValue = {
  status: StepStatus;
  expanded: boolean;
  onToggle: () => void;
  isLast: boolean;
  hasContent: boolean;
};

const StepCtx = createContext<StepCtxValue | null>(null);

function useStepCtx(): StepCtxValue {
  const ctx = useContext(StepCtx);
  if (!ctx) throw new Error("AgentTraceStep.* must be used within <AgentTraceStep>");
  return ctx;
}

/* ─── AgentTrace ─── */

export type AgentTraceProps = {
  children: ReactNode;
};

export function AgentTrace({ children }: AgentTraceProps) {
  const array = Children.toArray(children);
  return (
    <div className="flex flex-col gap-2">
      {array.map((child, i) =>
        isValidElement(child)
          ? cloneElement(child as React.ReactElement<{ isLast?: boolean }>, {
              isLast: i === array.length - 1,
            })
          : child,
      )}
    </div>
  );
}

/* ─── StatusIcon ─── */

function StatusIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "running":
      return <LoaderCircle size={12} className="animate-spin" aria-label="Running" />;
    case "complete":
      return <Check size={12} aria-label="Completed" />;
    case "error":
      return <AlertTriangle size={12} aria-label="Failed" />;
    case "waiting":
      return <ShieldAlert size={12} aria-label="Waiting" />;
    default:
      return <Circle size={6} aria-label="Pending" />;
  }
}

function statusColor(status: StepStatus): string {
  switch (status) {
    case "running": return "text-primary";
    case "complete": return "text-[var(--success)]";
    case "error": return "text-destructive";
    case "waiting": return "text-[var(--warning)]";
    default: return "text-muted-foreground/50";
  }
}

/* ─── AgentTraceStep ─── */

export type AgentTraceStepProps = {
  children: ReactNode;
  status?: StepStatus;
  defaultExpanded?: boolean;
  isLast?: boolean;
  hasContent?: boolean;
};

export function AgentTraceStep({
  children,
  status = "pending",
  defaultExpanded,
  isLast = false,
  hasContent: hasContentProp,
}: AgentTraceStepProps) {
  const [internalExpanded, setInternalExpanded] = useState(
    defaultExpanded ?? (status === "running" || status === "error" || status === "waiting"),
  );
  const wasAutoOpened = useRef(false);

  useEffect(() => {
    if (defaultExpanded === false) return;
    if (status === "running" || status === "error" || status === "waiting") {
      if (!wasAutoOpened.current) {
        setInternalExpanded(true);
        wasAutoOpened.current = true;
      }
    }
  }, [defaultExpanded, status]);

  const expanded = internalExpanded;

  const onToggle = useCallback(() => {
    setInternalExpanded((v) => !v);
    wasAutoOpened.current = false;
  }, []);

  let trigger: ReactNode = null;
  let content: ReactNode = null;

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === AgentTraceTrigger) trigger = child;
    else if (child.type === AgentTraceContent) content = child;
  });
  const hasContent = hasContentProp ?? Boolean(content);

  return (
    <StepCtx.Provider value={{ status, expanded, onToggle, isLast, hasContent }}>
      <div className="grid grid-cols-[24px_minmax(0,1fr)] gap-x-3">
        {/* Icon / connector column */}
        <div className="flex flex-col items-center">
          <div className={cn("flex size-6 shrink-0 items-center justify-center rounded-full bg-background/60", statusColor(status))}>
            <StatusIcon status={status} />
          </div>
          {!isLast && (
            <div className="w-px flex-1 bg-foreground/10" />
          )}
        </div>

        {/* Content column */}
        <div className={cn("min-w-0", !isLast && "pb-2")}>
          {trigger}
          {hasContent && (
            <div
              className="terax-reveal"
              data-state={expanded ? "open" : "closed"}
            >
              <div className="mt-2 flex flex-col gap-2">
                {content}
              </div>
            </div>
          )}
        </div>
      </div>
    </StepCtx.Provider>
  );
}

/* ─── AgentTraceTrigger ─── */

export type AgentTraceTriggerProps = {
  children: ReactNode;
  leftIcon?: ReactNode;
};

export function AgentTraceTrigger({ children, leftIcon }: AgentTraceTriggerProps) {
  const { status, expanded, onToggle } = useStepCtx();
  const { hasContent } = useStepCtx();

  return (
    <button
      type="button"
      onClick={hasContent ? onToggle : undefined}
      aria-expanded={expanded}
      className={cn(
        "flex min-h-7 w-full items-center gap-2 rounded-md bg-transparent p-0 text-left text-sm leading-tight transition-colors duration-[var(--dur-fast)] ease-[var(--ease-soft)] hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
        hasContent ? "cursor-pointer px-1" : "cursor-default px-1",
        status === "running" ? "font-semibold text-foreground" : "font-medium",
        status === "error" && "text-destructive",
        status === "waiting" && "text-[var(--warning)]",
        status !== "running" && status !== "error" && status !== "waiting" && "text-muted-foreground",
      )}
    >
      {leftIcon && (
        <span className="flex shrink-0 text-muted-foreground">
          {leftIcon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        {children}
      </span>
      {hasContent && (
        <span
          className={cn(
            "flex shrink-0 text-muted-foreground/55 transition-transform duration-[var(--dur-base)] ease-[var(--ease-premium)]",
            expanded && "rotate-180",
          )}
        >
          <ChevronDown size={11} />
        </span>
      )}
    </button>
  );
}

/* ─── AgentTraceContent ─── */

export type AgentTraceContentProps = {
  children: ReactNode;
};

export function AgentTraceContent({ children }: AgentTraceContentProps) {
  return <>{children}</>;
}

/* ─── AgentTraceItem ─── */

export type AgentTraceItemProps = {
  children: ReactNode;
  secondary?: ReactNode;
};

export function AgentTraceItem({ children, secondary }: AgentTraceItemProps) {
  return (
    <div className="flex items-baseline gap-2 py-px">
      <div className="min-w-0 flex-1 text-[13px] leading-5 text-muted-foreground">
        {children}
      </div>
      {secondary && (
        <div className="shrink-0 text-[11px] text-muted-foreground/55">{secondary}</div>
      )}
    </div>
  );
}

/* ─── AgentTraceBadge ─── */

export type AgentTraceBadgeProps = {
  children: ReactNode;
  color?: string;
};

export function AgentTraceBadge({ children, color }: AgentTraceBadgeProps) {
  return (
    <span
      className="inline-flex max-w-80 items-center overflow-hidden truncate rounded-[5px] border border-border/60 bg-accent px-1 py-px font-mono text-[10.5px] font-semibold leading-normal text-muted-foreground"
      style={color ? { color } : undefined}
    >
      {children}
    </span>
  );
}
