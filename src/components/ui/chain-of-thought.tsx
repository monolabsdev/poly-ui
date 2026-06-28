import {
  Children,
  cloneElement,
  isValidElement,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import Box from "@mui/material/Box";
import { ChevronDown } from "lucide-react";


/* ─── ChainOfThought ─── */

export type ChainOfThoughtProps = {
  children: ReactNode;
} & HTMLAttributes<HTMLDivElement>;

export function ChainOfThought({ children, ...props }: ChainOfThoughtProps) {
  const array = Children.toArray(children);
  return (
    <Box {...props}>
      {array.map((child, i) =>
        isValidElement(child)
          ? cloneElement(child as React.ReactElement<ChainOfThoughtStepProps>, {
              isLast: i === array.length - 1,
            })
          : child,
      )}
    </Box>
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
    <Box
      sx={{
        display: "flex",
        gap: 1.5,
        "&:not(:last-child)": { mb: 0.5 },
      }}
    >
      {/* Timeline column */}
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: 16,
          flexShrink: 0,
        }}
      >
        <Box
          sx={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            bgcolor: isActive ? "text.primary" : "divider",
            flexShrink: 0,
            mt: 0.625,
            transition: "background-color 0.2s",
          }}
        />
        {!isLast && (
          <Box
            sx={{
              width: 1.5,
              flex: 1,
              bgcolor: "divider",
              mt: 0.5,
              minHeight: 16,
            }}
          />
        )}
      </Box>

      {/* Content column */}
      <Box sx={{ flex: 1, minWidth: 0, pb: isLast ? 0 : 1 }}>
        {trigger &&
          isValidElement(trigger) &&
          cloneElement(trigger as React.ReactElement<ChainOfThoughtTriggerProps>, {
            isActive,
            isExpanded,
            onToggle,
          })}
        {content && isExpanded && (
          <Box
            sx={{
              mt: 1,
              ml: "2px",
              pl: 1.5,
              borderLeft: "1.5px solid",
              borderColor: "divider",
            }}
          >
            {content}
          </Box>
        )}
      </Box>
    </Box>
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
    <Box
      component="button"
      onClick={onToggle}
      disabled={isActive}
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.75,
        cursor: isActive ? "default" : "pointer",
        border: "none",
        background: "none",
        p: 0,
        fontFamily: "inherit",
        fontSize: "13px",
        fontWeight: 500,
        color: "text.secondary",
        borderRadius: "9999px",
        transition: "color 0.15s",
        "&:hover": {
          color: isActive ? "text.secondary" : "text.primary",
        },
        "&:focus-visible": {
          outline: "2px solid",
          outlineColor: "text.primary",
          outlineOffset: "2px",
          borderRadius: "4px",
        },
      }}
    >
      {icon && (
        <Box
          component="span"
          sx={{
            display: "flex",
            alignItems: "center",
            color: "text.secondary",
            flexShrink: 0,
          }}
        >
          {icon}
        </Box>
      )}
      {isActive ? (
        <Box component="span" className="animate-thinking" sx={{ display: "inline" }}>
          {children}
        </Box>
      ) : (
        children
      )}
      {!isActive && (
        <Box
          component="span"
          sx={{
            display: "flex",
            alignItems: "center",
            color: "text.disabled",
            flexShrink: 0,
            transition: "transform 0.2s",
          }}
        >
          <ChevronDown size={13} />
        </Box>
      )}
    </Box>
  );
}

/* ─── ChainOfThoughtContent ─── */

export type ChainOfThoughtContentProps = {
  children: ReactNode;
};

export function ChainOfThoughtContent({ children }: ChainOfThoughtContentProps) {
  return <>{children}</>;
}
