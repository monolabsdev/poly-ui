import * as React from "react";
import { cn } from "@/lib/utils";

type InputBaseProps = React.InputHTMLAttributes<HTMLInputElement> & {
  multiline?: boolean;
  minRows?: number;
  inputRef?: React.Ref<HTMLInputElement | HTMLTextAreaElement>;
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  fullWidth?: boolean;
};

export function InputBase({
  className,
  multiline,
  minRows,
  inputRef,
  inputProps,
  fullWidth,
  ...props
}: InputBaseProps) {
  const baseClassName = cn(
    "w-full min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground",
    fullWidth && "w-full",
    className,
  );

  if (multiline) {
    return (
      <textarea
        ref={inputRef as React.Ref<HTMLTextAreaElement>}
        rows={minRows}
        className={baseClassName}
        {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
      />
    );
  }

  return (
      <input
        ref={inputRef as React.Ref<HTMLInputElement>}
        className={baseClassName}
        {...inputProps}
        {...props}
      />
  );
}
