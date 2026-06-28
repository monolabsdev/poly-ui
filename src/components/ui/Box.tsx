import * as React from "react";
import { cn } from "@/lib/utils";

const displayClasses = {
  flex: "flex",
  block: "block",
  inline: "inline",
  "inline-flex": "inline-flex",
  grid: "grid",
  none: "hidden",
} as const;

const directionClasses = {
  row: "flex-row",
  column: "flex-col",
  "row-reverse": "flex-row-reverse",
  "column-reverse": "flex-col-reverse",
} as const;

const alignClasses = {
  start: "items-start",
  "flex-start": "items-start",
  center: "items-center",
  end: "items-end",
  "flex-end": "items-end",
  stretch: "items-stretch",
  baseline: "items-baseline",
} as const;

const justifyClasses = {
  start: "justify-start",
  "flex-start": "justify-start",
  center: "justify-center",
  end: "justify-end",
  "flex-end": "justify-end",
  between: "justify-between",
  "space-between": "justify-between",
  around: "justify-around",
  "space-around": "justify-around",
  evenly: "justify-evenly",
  "space-evenly": "justify-evenly",
} as const;

const spaceClasses: Record<number, string> = {
  0: "0",
  0.25: "1",
  0.5: "1",
  0.75: "1.5",
  1: "2",
  1.25: "2.5",
  1.5: "3",
  2: "4",
  2.5: "5",
  3: "6",
  4: "8",
  5: "10",
  6: "12",
  8: "16",
  9: "18",
};

type SpaceProp = keyof typeof spaceClasses | number;

export type BoxProps<T extends React.ElementType = "div"> = {
  as?: T;
  display?: keyof typeof displayClasses;
  flex?: boolean;
  flexDirection?: keyof typeof directionClasses;
  gap?: SpaceProp;
  alignItems?: keyof typeof alignClasses | { xs?: keyof typeof alignClasses; sm?: keyof typeof alignClasses };
  justifyContent?: keyof typeof justifyClasses | { xs?: keyof typeof justifyClasses; sm?: keyof typeof justifyClasses };
  p?: SpaceProp;
  m?: SpaceProp;
  className?: string;
  onClick?: React.MouseEventHandler<any>;
  onMouseDown?: React.MouseEventHandler<any>;
  onMouseEnter?: React.MouseEventHandler<any>;
  onMouseLeave?: React.MouseEventHandler<any>;
  onKeyDown?: React.KeyboardEventHandler<any>;
} & Record<string, any>;

function space(prefix: string, value: SpaceProp | undefined) {
  if (value === undefined) return undefined;
  const token = spaceClasses[value as keyof typeof spaceClasses];
  return token === "0" ? `${prefix}-0` : token ? `${prefix}-${token}` : undefined;
}

export const Box = React.forwardRef(function Box<T extends React.ElementType = "div">(
  {
    as,
    display,
    flex,
    flexDirection,
    gap,
    alignItems,
    justifyContent,
    p,
    m,
    className,
    ...props
  }: BoxProps<T>,
  ref: React.Ref<any>,
) {
  const Component = (as ?? "div") as React.ElementType;
  const resolvedAlignItems =
    typeof alignItems === "object" ? (alignItems.xs ?? alignItems.sm) : alignItems;
  const resolvedJustifyContent =
    typeof justifyContent === "object" ? (justifyContent.xs ?? justifyContent.sm) : justifyContent;

  return (
    <Component
      ref={ref}
      className={cn(
        flex && "flex",
        display && displayClasses[display],
        flexDirection && directionClasses[flexDirection],
        gap !== undefined && space("gap", gap),
        resolvedAlignItems && alignClasses[resolvedAlignItems],
        resolvedJustifyContent && justifyClasses[resolvedJustifyContent],
        p !== undefined && space("p", p),
        m !== undefined && space("m", m),
        className,
      )}
      {...props}
    />
  );
}) as <T extends React.ElementType = "div">(
  props: BoxProps<T> & { ref?: React.Ref<any> },
) => React.ReactElement | null;
