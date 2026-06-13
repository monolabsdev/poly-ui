import type { ReactNode } from 'react'
import { useIsIdle } from './hooks'

export function IdleUnmount({ children, fallback }: { children: ReactNode; fallback?: ReactNode }) {
  const isIdle = useIsIdle()
  if (isIdle) return fallback ?? null
  return children
}
