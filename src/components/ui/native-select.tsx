import * as React from "react"

import { cn } from "@/lib/utils"
import { ChevronDownIcon } from "lucide-react"

type NativeSelectProps = Omit<React.ComponentProps<"select">, "size"> & {
  size?: "sm" | "default"
  fullWidth?: boolean
  displayEmpty?: boolean
  label?: React.ReactNode
  IconComponent?: React.ComponentType
  renderValue?: (value: unknown) => React.ReactNode
  MenuProps?: unknown
}

function NativeSelect({
  className,
  size = "default",
  fullWidth,
  displayEmpty: _displayEmpty,
  label: _label,
  IconComponent: _IconComponent,
  renderValue: _renderValue,
  MenuProps: _MenuProps,
  ...props
}: NativeSelectProps) {
  return (
    <div
      className={cn(
        "group/native-select relative w-fit has-[select:disabled]:opacity-50",
        fullWidth && "w-full",
        className
      )}
      data-slot="native-select-wrapper"
      data-size={size}
    >
      <select
        data-slot="native-select"
        data-size={size}
        className="h-8 w-full min-w-0 appearance-none rounded-2xl border border-transparent bg-input/50 py-1 pr-8 pl-2.5 text-sm transition-[color,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-soft)] outline-none select-none selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[size=sm]:h-7 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40"
        {...props}
      />
      <ChevronDownIcon className="pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2 text-muted-foreground select-none" aria-hidden="true" data-slot="native-select-icon" />
    </div>
  )
}

function NativeSelectOption({
  className,
  ...props
}: React.ComponentProps<"option">) {
  return (
    <option
      data-slot="native-select-option"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  )
}

function NativeSelectOptGroup({
  className,
  ...props
}: React.ComponentProps<"optgroup">) {
  return (
    <optgroup
      data-slot="native-select-optgroup"
      className={cn("bg-[Canvas] text-[CanvasText]", className)}
      {...props}
    />
  )
}

export type SelectChangeEvent<T = string> = React.ChangeEvent<HTMLSelectElement> & {
  target: EventTarget & HTMLSelectElement & { value: T }
}

function FormControl({
  className,
  fullWidth,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { fullWidth?: boolean; size?: "small" | "medium" }) {
  return (
    <div className={cn("grid gap-1.5", fullWidth && "w-full", className)} {...props}>
      {children}
    </div>
  )
}

function InputLabel({
  className,
  ...props
}: React.ComponentProps<"label">) {
  return <label className={className} {...props} />
}

const Select = NativeSelect
const MenuItem = NativeSelectOption

export {
  NativeSelect,
  NativeSelectOptGroup,
  NativeSelectOption,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
}
