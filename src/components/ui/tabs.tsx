import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Tabs as TabsPrimitive } from "radix-ui"

import { cn } from "@/lib/utils"

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-horizontal:flex-col",
        className
      )}
      {...props}
    />
  )
}

const tabsListVariants = cva(
  "group/tabs-list inline-flex w-fit items-center justify-center rounded-2xl p-[3px] text-muted-foreground group-data-horizontal/tabs:h-8 group-data-vertical/tabs:h-fit group-data-vertical/tabs:flex-col group-data-vertical/tabs:p-1 data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function TabsList({
  className,
  variant = "default",
  onWheel,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List> &
  VariantProps<typeof tabsListVariants>) {
  const listRef = React.useRef<HTMLDivElement | null>(null)
  const [pill, setPill] = React.useState({ left: 0, width: 0 })
  const [pillReady, setPillReady] = React.useState(false)

  const updatePill = React.useCallback(() => {
    const list = listRef.current
    if (!list) return
    const active = list.querySelector<HTMLElement>(
      '[data-slot="tabs-trigger"][data-state="active"], [data-slot="tabs-trigger"][data-active]'
    )
    if (!active) return
    const listRect = list.getBoundingClientRect()
    const activeRect = active.getBoundingClientRect()
    const left = activeRect.left - listRect.left + list.scrollLeft
    const width = activeRect.width
    setPill((prev) => prev.left === left && prev.width === width ? prev : { left, width })
  }, [])

  React.useLayoutEffect(() => {
    updatePill()
    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(() => setPillReady(true))
    })
    const observer = new ResizeObserver(updatePill)
    if (listRef.current) observer.observe(listRef.current)
    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
    }
  })

  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      ref={listRef}
      onWheel={(event) => {
        const el = event.currentTarget
        if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
          el.scrollLeft += event.deltaY
          event.preventDefault()
        }
        onWheel?.(event)
      }}
      className={cn("relative overflow-x-auto", tabsListVariants({ variant }), className)}
      {...props}
    >
      {variant !== "line" && (
        <div
          data-slot="tabs-pill"
          aria-hidden="true"
          className="absolute top-[50%] z-0 h-[calc(100%-6px)] translate-y-[-50%] rounded-2xl bg-accent"
          style={{
            width: pill.width,
            transform: `translate(${pill.left}px, -50%)`,
            transition: pillReady
              ? "transform var(--dur-base) var(--ease-premium), width var(--dur-base) var(--ease-premium)"
              : "none",
          }}
        />
      )}
      {props.children}
    </TabsPrimitive.List>
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      className={cn(
        "relative z-10 inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-2xl border border-transparent! bg-transparent px-1.5 py-0.5 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all duration-[var(--dur-base)] ease-[var(--ease-premium)] group-data-vertical/tabs:w-full group-data-vertical/tabs:justify-start group-data-vertical/tabs:px-3 group-data-vertical/tabs:py-0.5 hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-transparent data-active:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground dark:data-active:border-transparent dark:data-active:bg-transparent dark:data-active:text-foreground",
        "after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-horizontal/tabs:after:inset-x-0 group-data-horizontal/tabs:after:bottom-[-5px] group-data-horizontal/tabs:after:h-0.5 group-data-vertical/tabs:after:inset-y-0 group-data-vertical/tabs:after:-right-1 group-data-vertical/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  )
}

export { Tabs, TabsList, TabsTrigger, TabsContent, tabsListVariants }
