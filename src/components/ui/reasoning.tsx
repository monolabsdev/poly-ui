import { ChevronDown } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { Box } from "@mui/material";

type ReasoningContextType = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
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
      value={{ isOpen, onOpenChange: handleOpenChange }}
    >
      <Box {...props}>{children}</Box>
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
  const { isOpen, onOpenChange } = useReasoningContext();

  return (
    <Box
      component="button"
      onClick={() => onOpenChange(!isOpen)}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        cursor: "pointer",
        border: "none",
        background: "none",
        p: 0,
        fontFamily: "inherit",
        fontSize: "inherit",
        color: "inherit",
      }}
      {...props}
    >
      <Box sx={{ color: "primary.main" }}>{children}</Box>
      <Box
        sx={{
          display: "flex",
          transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          transition: "transform 0.2s ease",
          color: "text.secondary",
        }}
      >
        <ChevronDown size={16} />
      </Box>
    </Box>
  );
}

export type ReasoningContentProps = {
  children: ReactNode;
  contentSx?: Record<string, unknown>;
} & HTMLAttributes<HTMLDivElement>;

export function ReasoningContent({
  children,
  contentSx,
  ...props
}: ReasoningContentProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const { isOpen } = useReasoningContext();
  const [maxHeight, setMaxHeight] = useState("0px");

  const updateHeight = useCallback(() => {
    if (innerRef.current) {
      setMaxHeight(isOpen ? `${innerRef.current.scrollHeight}px` : "0px");
    }
  }, [isOpen]);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const observer = new ResizeObserver(updateHeight);
    observer.observe(inner);
    updateHeight();
    return () => observer.disconnect();
  }, [updateHeight]);

  useEffect(() => {
    updateHeight();
  }, [isOpen, updateHeight]);

  return (
    <Box
      ref={outerRef}
      sx={{
        overflow: "hidden",
        transition: "max-height 0.2s ease-out",
        maxHeight,
      }}
      {...props}
    >
      <Box
        ref={innerRef}
        sx={{ color: "text.secondary", ...contentSx }}
      >
        {children}
      </Box>
    </Box>
  );
}
