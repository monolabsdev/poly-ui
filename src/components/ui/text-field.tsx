import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type TextFieldProps = {
  label?: React.ReactNode;
  helperText?: React.ReactNode;
  error?: boolean;
  fullWidth?: boolean;
  multiline?: boolean;
  minRows?: number;
  maxRows?: number;
  rows?: number;
  variant?: string;
  slotProps?: {
    htmlInput?: React.InputHTMLAttributes<HTMLInputElement>;
    input?: {
      endAdornment?: React.ReactNode;
      startAdornment?: React.ReactNode;
      className?: string;
      sx?: unknown;
    };
  };
  InputProps?: { startAdornment?: React.ReactNode; endAdornment?: React.ReactNode };
  inputProps?: React.InputHTMLAttributes<HTMLInputElement>;
  size?: "small" | "medium";
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">;

export function TextField({
  label,
  helperText,
  error,
  fullWidth,
  multiline,
  minRows,
  maxRows,
  rows,
  variant: _variant,
  slotProps,
  InputProps,
  inputProps,
  className,
  id,
  size: _size,
  ...props
}: TextFieldProps) {
  const generatedId = React.useId();
  const inputId = id ?? generatedId;
  const adornments = {
    startAdornment: InputProps?.startAdornment ?? slotProps?.input?.startAdornment,
    endAdornment: InputProps?.endAdornment ?? slotProps?.input?.endAdornment,
  };
  const inputClassName = cn(error && "border-destructive focus-visible:ring-destructive/30", adornments.startAdornment && "pl-8", className);
  const style = {
    ...(rows ? { minHeight: `${rows * 1.5 + 1}rem` } : null),
    ...(minRows ? { minHeight: `${minRows * 1.5 + 1}rem` } : null),
    ...(maxRows ? { maxHeight: `${maxRows * 1.5 + 1}rem` } : null),
  } as React.CSSProperties;

  return (
    <div className={cn("grid gap-1.5", fullWidth && "w-full")}>
      {label ? <Label htmlFor={inputId}>{label}</Label> : null}
      <div className="relative">
        {adornments.startAdornment ? (
          <span className="pointer-events-none absolute top-1/2 left-2 flex -translate-y-1/2 text-muted-foreground">
            {adornments.startAdornment}
          </span>
        ) : null}
        {multiline ? (
          <Textarea
            id={inputId}
            className={inputClassName}
            style={style}
            {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
          />
        ) : (
          <Input
            id={inputId}
            className={inputClassName}
            {...inputProps}
            {...slotProps?.htmlInput}
            {...props}
          />
        )}
        {adornments.endAdornment ? (
          <span className="absolute top-1/2 right-2 flex -translate-y-1/2 text-muted-foreground">
            {adornments.endAdornment}
          </span>
        ) : null}
      </div>
      {helperText ? (
        <p className={cn("text-xs", error ? "text-destructive" : "text-muted-foreground")}>
          {helperText}
        </p>
      ) : null}
    </div>
  );
}
