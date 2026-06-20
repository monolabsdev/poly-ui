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
import { Box, Collapse } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { ChevronDown, Check, Circle, AlertTriangle, LoaderCircle, ShieldAlert } from "lucide-react";

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
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.15 }}>
      {array.map((child, i) =>
        isValidElement(child)
          ? cloneElement(child as React.ReactElement<{ isLast?: boolean }>, {
              isLast: i === array.length - 1,
            })
          : child,
      )}
    </Box>
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
    case "running": return "primary.main";
    case "complete": return "success.main";
    case "error": return "error.main";
    case "waiting": return "warning.main";
    default: return "text.disabled";
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
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "18px minmax(0, 1fr)",
          columnGap: 1,
        }}
      >
        {/* Icon / connector column */}
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: 18,
              width: 18,
              flexShrink: 0,
              color: statusColor(status),
            }}
          >
            <StatusIcon status={status} />
          </Box>
          {!isLast && (
            <Box
              sx={{
                width: "1px",
                flex: 1,
                bgcolor: (theme) => alpha(theme.palette.text.primary, 0.1),
              }}
            />
          )}
        </Box>

        {/* Content column */}
        <Box sx={{ minWidth: 0, pb: isLast ? 0 : 0.65 }}>
          {trigger}
          {hasContent && (
            <Collapse in={expanded} timeout={200}>
              <Box sx={{ mt: 0.35, pl: 0.1, display: "flex", flexDirection: "column", gap: 0.2 }}>
                {content}
              </Box>
            </Collapse>
          )}
        </Box>
      </Box>
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
    <Box
      component="button"
      type="button"
      onClick={hasContent ? onToggle : undefined}
      aria-expanded={expanded}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 0.65,
        width: "100%",
        cursor: hasContent ? "pointer" : "default",
        border: "none",
        background: "none",
        p: 0,
        fontFamily: "inherit",
        fontSize: 12.5,
        fontWeight: status === "running" ? 650 : 500,
        color:
          status === "error"
            ? "error.main"
            : status === "waiting"
              ? "warning.main"
              : status === "running"
                ? "text.primary"
                : "text.secondary",
        textAlign: "left",
        lineHeight: 1.35,
        minHeight: 22,
        borderRadius: "5px",
        px: hasContent ? 0.25 : 0,
        transition: "color 0.15s",
        "&:hover": { color: "text.primary" },
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "primary.main",
          outlineOffset: 1,
        },
      }}
    >
      {leftIcon && (
        <Box component="span" sx={{ display: "flex", flexShrink: 0, color: "text.secondary" }}>
          {leftIcon}
        </Box>
      )}
      <Box component="span" sx={{ flex: 1, minWidth: 0 }}>
        {children}
      </Box>
      {hasContent && (
        <Box
          component="span"
          sx={{
            display: "flex",
            flexShrink: 0,
            color: "text.disabled",
            opacity: 0.55,
            transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
            transition: "transform 0.2s ease",
          }}
        >
          <ChevronDown size={11} />
        </Box>
      )}
    </Box>
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
    <Box sx={{ display: "flex", alignItems: "baseline", gap: 0.75, py: 0.05 }}>
      <Box sx={{ flex: 1, minWidth: 0, fontSize: 12, color: "text.secondary", lineHeight: 1.45 }}>
        {children}
      </Box>
      {secondary && (
        <Box sx={{ flexShrink: 0, fontSize: 11, color: "text.disabled" }}>{secondary}</Box>
      )}
    </Box>
  );
}

/* ─── AgentTraceBadge ─── */

export type AgentTraceBadgeProps = {
  children: ReactNode;
  color?: string;
};

export function AgentTraceBadge({ children, color }: AgentTraceBadgeProps) {
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: 0.5,
        py: 0.05,
        borderRadius: "5px",
        fontSize: 10.5,
        fontWeight: 650,
        fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
        color: color ?? "text.secondary",
        bgcolor: "action.hover",
        border: "1px solid",
        borderColor: "border.light",
        lineHeight: 1.5,
        maxWidth: 320,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </Box>
  );
}
