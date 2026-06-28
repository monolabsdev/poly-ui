"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { Box } from "@/components/ui/Box"
import { Link } from "@/components/ui/link"
import { Paper } from "@/components/ui/Paper"
import { Popper } from "@/components/ui/floating"
import { Typography } from "@/components/ui/Typography"

// ─── Context ────────────────────────────────────────────

interface SourceContextValue {
  href: string
  domain: string
  scheduleShow: (el: HTMLElement) => void
  scheduleHide: () => void
  cancelHide: () => void
  setContentProps: (props: { title: string; description: string } | null) => void
}

const SourceContext = createContext<SourceContextValue | null>(null)

function useSourceContext() {
  const ctx = useContext(SourceContext)
  if (!ctx) throw new Error("Source.* components must be used inside <Source>")
  return ctx
}

// ─── Source Root ────────────────────────────────────────

export interface SourceProps {
  href: string
  children: ReactNode
}

export function Source({ href, children }: SourceProps) {
  let domain = ""
  try {
    domain = new URL(href).hostname
  } catch {
    domain = href.split("/").pop() || href
  }

  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null)
  const [open, setOpen] = useState(false)
  const [contentProps, setContentProps] = useState<{
    title: string
    description: string
  } | null>(null)
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const scheduleShow = useCallback((el: HTMLElement) => {
    clearTimeout(hideTimeoutRef.current)
    clearTimeout(showTimeoutRef.current)
    showTimeoutRef.current = setTimeout(() => {
      setAnchorEl(el)
      setOpen(true)
    }, 150)
  }, [])

  const scheduleHide = useCallback(() => {
    clearTimeout(showTimeoutRef.current)
    clearTimeout(hideTimeoutRef.current)
    hideTimeoutRef.current = setTimeout(() => {
      setOpen(false)
      setAnchorEl(null)
    }, 100)
  }, [])

  const cancelHide = useCallback(() => {
    clearTimeout(hideTimeoutRef.current)
  }, [])

  useEffect(() => {
    return () => {
      clearTimeout(showTimeoutRef.current)
      clearTimeout(hideTimeoutRef.current)
    }
  }, [])

  return (
    <SourceContext.Provider
      value={{ href, domain, scheduleShow, scheduleHide, cancelHide, setContentProps }}
    >
      <Box>
        {children}
      </Box>
      <Popper
        open={open}
        anchorEl={anchorEl}
        placement="bottom-start"
      >
        <Paper
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
          elevation={0}
        >
          {contentProps && (
            <Link
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              underline="none"
            >
              <Box>
                <Box
                  as="img"
                  src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(href)}`}
                  alt=""
                />
                <Typography
                  variant="body2"
                >
                  {domain.replace("www.", "")}
                </Typography>
              </Box>
              <Typography
                variant="body2"
              >
                {contentProps.title}
              </Typography>
              <Typography
                variant="body2"
              >
                {contentProps.description}
              </Typography>
            </Link>
          )}
        </Paper>
      </Popper>
    </SourceContext.Provider>
  )
}

// ─── SourceTrigger ──────────────────────────────────────

export interface SourceTriggerProps {
  label?: string | number
  showFavicon?: boolean
  className?: string
}

export function SourceTrigger({
  label,
  showFavicon = false,
  className,
}: SourceTriggerProps) {
  const { href, domain, scheduleShow, scheduleHide } = useSourceContext()
  const ref = useRef<HTMLAnchorElement>(null)
  const labelToShow = label ?? domain.replace("www.", "")

  return (
    <Link
      ref={ref}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onMouseEnter={() => { if (ref.current) scheduleShow(ref.current) }}
      onMouseLeave={scheduleHide}
      underline="none"
      className={className}
    >
      {showFavicon && (
        <Box
          as="img"
          src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(href)}`}
          alt=""
        />
      )}
      <Box
        as="span"
      >
        {labelToShow}
      </Box>
    </Link>
  )
}

// ─── SourceContent ──────────────────────────────────────

export interface SourceContentProps {
  title: string
  description: string
  className?: string
}

export function SourceContent({ title, description }: SourceContentProps) {
  const { setContentProps } = useSourceContext()

  useEffect(() => {
    setContentProps({ title, description })
  }, [title, description, setContentProps])

  return null
}
