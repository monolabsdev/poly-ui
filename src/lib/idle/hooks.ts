import {
  useEffect,
  useRef,
  useCallback,
  useSyncExternalStore,
  useState,
} from 'react'
import { idleManager, type IdleHandler } from './manager'

let _hookId = 0
function nextId() { return `idle-hook-${++_hookId}` }

export function useIsIdle() {
  return useSyncExternalStore(
    (onStoreChange) => idleManager.onStateChange(onStoreChange),
    () => idleManager.isIdle,
    () => false,
  )
}

export function useIdleState() {
  return useSyncExternalStore(
    (onStoreChange) => idleManager.onStateChange(onStoreChange),
    () => idleManager.state,
    () => 'active' as const,
  )
}

export function usePauseableHandler(id: string, handler: IdleHandler) {
  const stableRef = useRef(handler)
  stableRef.current = handler
  const cb = useCallback(() => {
    const h = stableRef.current
    return idleManager.register(id, h)
  }, [id])
  useEffect(() => cb(), [cb])
}

export function usePauseableInterval(
  fn: () => void,
  ms: number,
  opts?: { immediateOnResume?: boolean; id?: string },
) {
  const savedFn = useRef(fn)
  savedFn.current = fn
  const timer = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastRun = useRef(Date.now())
  const [id] = useState(() => opts?.id ?? `interval:${ms}:${nextId()}`)

  const stopTimer = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current)
      timer.current = null
    }
  }, [])

  const startTimer = useCallback(() => {
    if (timer.current) return
    timer.current = setInterval(() => {
      savedFn.current()
      lastRun.current = Date.now()
    }, ms)
  }, [ms])

  useEffect(() => {
    return idleManager.register(id, {
      onPause: stopTimer,
      onResume: () => {
        if (opts?.immediateOnResume) {
          const elapsed = Date.now() - lastRun.current
          if (elapsed >= ms * 1.5) {
            savedFn.current()
            lastRun.current = Date.now()
          }
        }
        startTimer()
      },
    })
  }, [id, ms, opts?.immediateOnResume, stopTimer, startTimer])

  useEffect(() => {
    if (!idleManager.isIdle) startTimer()
    return stopTimer
  }, [startTimer, stopTimer])

  const runNow = useCallback(() => {
    savedFn.current()
    lastRun.current = Date.now()
  }, [])

  return runNow
}

export function useIdleBlock(condition?: boolean) {
  const unblockRef = useRef<(() => void) | null>(null)
  const prevCondition = useRef<boolean | undefined>(undefined)

  useEffect(() => {
    if (condition === prevCondition.current) return
    prevCondition.current = condition

    if (condition) {
      unblockRef.current = idleManager.blockIdle()
    } else {
      unblockRef.current?.()
      unblockRef.current = null
    }

    return () => {
      unblockRef.current?.()
      unblockRef.current = null
    }
  }, [condition])
}

type RAFMode = 'stop' | 'throttle'

export function usePauseableAnimationFrame(
  fn: (ts: number, dt: number) => void,
  opts?: { id?: string; mode?: RAFMode; throttleMs?: number },
) {
  const savedFn = useRef(fn)
  savedFn.current = fn
  const rafRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const lastTimeRef = useRef<number | null>(null)
  const { mode = 'stop', throttleMs = 1000 } = opts ?? {}
  const [id] = useState(() => opts?.id ?? `raf:${nextId()}`)

  const scheduleRAF = useCallback(function scheduleRAF() {
    rafRef.current = requestAnimationFrame((ts) => {
      rafRef.current = null
      const dt = lastTimeRef.current !== null ? ts - lastTimeRef.current : 0
      lastTimeRef.current = ts
      savedFn.current(ts, dt)
      scheduleRAF()
    })
  }, [])

  const startThrottled = useCallback(() => {
    timerRef.current = setInterval(() => {
      const ts = performance.now()
      const dt = lastTimeRef.current !== null ? ts - lastTimeRef.current : 0
      lastTimeRef.current = ts
      savedFn.current(ts, dt)
    }, throttleMs)
  }, [throttleMs])

  const cancelAll = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (timerRef.current !== null) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  useEffect(() => {
    return idleManager.register(id, {
      onPause: () => {
        cancelAll()
        if (mode === 'throttle') startThrottled()
      },
      onResume: () => {
        cancelAll()
        lastTimeRef.current = null
        scheduleRAF()
      },
    })
  }, [id, mode, scheduleRAF, startThrottled, cancelAll])

  useEffect(() => {
    if (!idleManager.isIdle) scheduleRAF()
    return cancelAll
  }, [scheduleRAF, cancelAll])
}

export function useStartIdleManager() {
  useEffect(() => {
    idleManager.start()
    return () => { idleManager.stop() }
  }, [])
}
