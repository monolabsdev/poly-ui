import { ChevronDown } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

type ReasoningContextType = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  panelId: string;
};

const ReasoningContext = createContext<ReasoningContextType | undefined>(
  undefined,
);

function useReasoningContext() {
  const context = useContext(ReasoningContext);
  if (!context) {
    throw new Error(
      "Reasoning.* must be used within a <Reasoning> component",
    );
  }
  return context;
}

export type ReasoningProps = {
  children: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  isStreaming?: boolean;
} & HTMLAttributes<HTMLDivElement>;

export function Reasoning({
  children,
  open,
  onOpenChange,
  isStreaming,
  ...props
}: ReasoningProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [wasAutoOpened, setWasAutoOpened] = useState(false);

  const isControlled = open !== undefined;
  const isOpen = isControlled ? open : internalOpen;
  const panelId = useId();

  const handleOpenChange = useCallback(
    (newOpen: boolean) => {
      if (!isControlled) {
        setInternalOpen(newOpen);
      }
      onOpenChange?.(newOpen);
    },
    [isControlled, onOpenChange],
  );

  useEffect(() => {
    if (isStreaming && !wasAutoOpened) {
      if (!isControlled) setInternalOpen(true);
      setWasAutoOpened(true);
    }
    if (!isStreaming && wasAutoOpened) {
      if (!isControlled) setInternalOpen(false);
      setWasAutoOpened(false);
    }
  }, [isStreaming, wasAutoOpened, isControlled]);

  return (
    <ReasoningContext.Provider
      value={{ isOpen, onOpenChange: handleOpenChange, panelId }}
    >
      <div {...props}>{children}</div>
    </ReasoningContext.Provider>
  );
}

export type ReasoningTriggerProps = {
  children: ReactNode;
} & HTMLAttributes<HTMLButtonElement>;

export function ReasoningTrigger({
  children,
  ...props
}: ReasoningTriggerProps) {
  const { isOpen, onOpenChange, panelId } = useReasoningContext();

  return (
    <button
      type="button"
      onClick={() => onOpenChange(!isOpen)}
      aria-expanded={isOpen}
      aria-controls={panelId}
      className="inline-flex min-h-6 cursor-pointer items-center gap-1.5 rounded-full bg-transparent p-0 font-inherit text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      {...props}
    >
      <span className="text-primary">{children}</span>
      <span
        className={cn(
          "flex text-muted-foreground transition-transform duration-[var(--dur-base)] ease-[var(--ease-premium)]",
          isOpen && "rotate-180",
        )}
      >
        <ChevronDown size={16} />
      </span>
    </button>
  );
}

export type ReasoningContentProps = {
  children: ReactNode;
  contentClassName?: string;
} & HTMLAttributes<HTMLDivElement>;

export function ReasoningContent({
  children,
  contentClassName,
  className,
  ...props
}: ReasoningContentProps) {
  const { isOpen, panelId } = useReasoningContext();

  return (
    <div
      id={panelId}
      role="region"
      data-state={isOpen ? "open" : "closed"}
      className={cn("terax-reveal", className)}
      {...props}
    >
      <div
        className={cn("text-muted-foreground", contentClassName)}
      >
        {children}
      </div>
    </div>
  );
}
