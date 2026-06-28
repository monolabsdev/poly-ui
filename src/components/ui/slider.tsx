import * as React from "react"
import { Slider as SliderPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

type SliderProps = Omit<React.ComponentProps<typeof SliderPrimitive.Root>, "value" | "defaultValue" | "onChange" | "onValueChange"> & {
  value?: number | number[]
  defaultValue?: number | number[]
  onChange?: (event: React.SyntheticEvent, value: number | number[]) => void
  onValueChange?: (value: number[]) => void
  valueLabelDisplay?: string
  valueLabelFormat?: (value: number) => React.ReactNode
}

function Slider({
  className,
  defaultValue,
  value,
  onChange,
  onValueChange,
  valueLabelDisplay: _valueLabelDisplay,
  valueLabelFormat: _valueLabelFormat,
  min = 0,
  max = 100,
  ...props
}: SliderProps) {
  const normalizedValue = Array.isArray(value) ? value : value === undefined ? undefined : [value]
  const normalizedDefaultValue = Array.isArray(defaultValue)
    ? defaultValue
    : defaultValue === undefined
      ? undefined
      : [defaultValue]
  const _values = React.useMemo(
    () =>
      normalizedValue
        ? normalizedValue
        : normalizedDefaultValue
          ? normalizedDefaultValue
          : [min, max],
    [normalizedValue, normalizedDefaultValue, min, max]
  )

  return (
    <SliderPrimitive.Root
      data-slot="slider"
      defaultValue={normalizedDefaultValue}
      value={normalizedValue}
      min={min}
      max={max}
      onValueChange={(next) => {
        onValueChange?.(next)
        onChange?.({} as React.SyntheticEvent, next.length === 1 ? next[0] : next)
      }}
      className={cn(
        "relative flex w-full touch-none items-center select-none data-disabled:opacity-50 data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:flex-col",
        className
      )}
      {...props}
    >
      <SliderPrimitive.Track
        data-slot="slider-track"
        className="relative grow overflow-hidden rounded-2xl bg-input/90 data-horizontal:h-1 data-horizontal:w-full data-vertical:h-full data-vertical:w-1"
      >
        <SliderPrimitive.Range
          data-slot="slider-range"
          className="absolute bg-primary select-none data-horizontal:h-full data-vertical:w-full"
        />
      </SliderPrimitive.Track>
      {Array.from({ length: _values.length }, (_, index) => (
        <SliderPrimitive.Thumb
          data-slot="slider-thumb"
          key={index}
          className="block size-4 shrink-0 rounded-2xl bg-background shadow-md ring-1 ring-border/60 transition-[color,box-shadow] duration-[var(--dur-base)] ease-[var(--ease-soft)] select-none not-dark:bg-clip-padding hover:ring-3 hover:ring-ring/30 focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-hidden disabled:pointer-events-none disabled:opacity-50"
        />
      ))}
    </SliderPrimitive.Root>
  )
}

export { Slider }
