import * as React from "react";
import { cn } from "@/lib/utils";

const variantClasses = {
  h1: "text-4xl font-semibold leading-tight",
  h2: "text-3xl font-semibold leading-tight",
  h3: "text-2xl font-semibold leading-tight",
  h4: "text-xl font-semibold leading-tight",
  h5: "text-lg font-semibold leading-tight",
  h6: "text-base font-semibold leading-tight",
  body: "text-sm leading-normal",
  body1: "text-sm leading-normal",
  body2: "text-sm leading-normal",
  subtitle1: "text-sm font-medium leading-normal",
  subtitle2: "text-xs font-medium leading-normal",
  caption: "text-xs leading-normal",
  overline: "text-[0.68rem] font-semibold uppercase leading-normal tracking-normal",
  small: "text-xs leading-normal",
} as const;

const weightClasses = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
} as const;

const colorClasses = {
  default: "text-foreground",
  "text.primary": "text-foreground",
  "text.secondary": "text-muted-foreground",
  secondary: "text-muted-foreground",
  muted: "text-muted-foreground",
  primary: "text-primary",
  destructive: "text-destructive",
  error: "text-destructive",
  disabled: "text-muted-foreground/70",
  inherit: "text-inherit",
} as const;

const alignClasses = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
} as const;

type Variant = keyof typeof variantClasses;

type TypographyProps<T extends React.ElementType = "p"> = {
  as?: T;
  variant?: Variant;
  weight?: keyof typeof weightClasses;
  color?: keyof typeof colorClasses;
  align?: keyof typeof alignClasses;
  noWrap?: boolean;
  gutterBottom?: boolean;
  className?: string;
} & Omit<React.ComponentPropsWithoutRef<T>, "as" | "className" | "color">;

function defaultTag(variant: Variant): React.ElementType {
  const headingTags = {
    h1: "h1",
    h2: "h2",
    h3: "h3",
    h4: "h4",
    h5: "h5",
    h6: "h6",
  } as const;
  return variant in headingTags ? headingTags[variant as keyof typeof headingTags] : "p";
}

export function Typography<T extends React.ElementType = "p">({
  as,
  variant = "body",
  weight,
  color = "default",
  align,
  noWrap,
  gutterBottom,
  className,
  ...props
}: TypographyProps<T>) {
  const Component = (as ?? defaultTag(variant)) as React.ElementType;

  return (
    <Component
      className={cn(
        variantClasses[variant],
        weight && weightClasses[weight],
        colorClasses[color],
        align && alignClasses[align],
        noWrap && "truncate",
        gutterBottom && "mb-2",
        className,
      )}
      {...props}
    />
  );
}
