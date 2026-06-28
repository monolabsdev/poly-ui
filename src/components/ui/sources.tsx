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
import Box from "@mui/material/Box"
import Link from "@mui/material/Link"
import Paper from "@mui/material/Paper"
import Popper from "@mui/material/Popper"
import Typography from "@mui/material/Typography"
import type { SxProps, Theme } from "@mui/material/styles"

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
      <Box sx={{ display: "inline-flex" }}>
        {children}
      </Box>
      <Popper
        open={open}
        anchorEl={anchorEl}
        placement="bottom-start"
        sx={{ zIndex: 1300, pt: 0.5 }}
      >
        <Paper
          onMouseEnter={cancelHide}
          onMouseLeave={scheduleHide}
          elevation={0}
          sx={{
            width: 320,
            borderRadius: (theme) => theme.app.radius.dialog,
            boxShadow: (theme) => theme.app.shadow.dialog,
            border: "1px solid",
            borderColor: "divider",
            overflow: "hidden",
          }}
        >
          {contentProps && (
            <Link
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              underline="none"
              sx={{
                display: "flex",
                flexDirection: "column",
                gap: 1.5,
                p: 2,
              }}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <Box
                  component="img"
                  src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(href)}`}
                  alt=""
                  sx={{ width: 16, height: 16, borderRadius: "50%" }}
                />
                <Typography
                  variant="body2"
                  sx={{
                    color: "text.primary",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {domain.replace("www.", "")}
                </Typography>
              </Box>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 600,
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                  color: "text.primary",
                }}
              >
                {contentProps.title}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: "text.secondary",
                  display: "-webkit-box",
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: "vertical",
                  overflow: "hidden",
                }}
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
  sx?: SxProps<Theme>
}

export function SourceTrigger({
  label,
  showFavicon = false,
  sx,
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
      sx={{
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        height: 20,
        maxWidth: 128,
        overflow: "hidden",
        borderRadius: "9999px",
        fontSize: "12px",
        lineHeight: 1,
        textDecoration: "none",
        bgcolor: "action.hover",
        color: "text.secondary",
        transition: "background 0.15s ease, color 0.15s ease",
        "&:hover": {
          bgcolor: "action.selected",
          color: "text.primary",
        },
        ...(showFavicon ? { pl: 0.5, pr: 1 } : { px: 0.5 }),
        ...sx,
      }}
    >
      {showFavicon && (
        <Box
          component="img"
          src={`https://www.google.com/s2/favicons?sz=64&domain_url=${encodeURIComponent(href)}`}
          alt=""
          sx={{ width: 14, height: 14, borderRadius: "50%", flexShrink: 0 }}
        />
      )}
      <Box
        component="span"
        sx={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          textAlign: "center",
          fontWeight: 400,
          fontVariantNumeric: "tabular-nums",
        }}
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
  sx?: SxProps<Theme>
}

export function SourceContent({ title, description }: SourceContentProps) {
  const { setContentProps } = useSourceContext()

  useEffect(() => {
    setContentProps({ title, description })
  }, [title, description, setContentProps])

  return null
}
