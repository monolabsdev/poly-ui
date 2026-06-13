import { idleManager } from './manager'

export type RAFMode = 'stop' | 'throttle'

export class PauseableRAF {
  private rafId: number | null = null
  private timerId: ReturnType<typeof setInterval> | null = null
  private lastTime: number | null = null
  private unregister: (() => void) | null = null
  private _running = false
  private _destroyed = false

  constructor(
    id: string,
    private cb: (ts: number, dt: number) => void,
    private mode: RAFMode = 'stop',
    private throttleMs = 1000,
  ) {
    this.unregister = idleManager.register(id, {
      onPause: () => this.handlePause(),
      onResume: () => this.handleResume(),
    })
  }

  get running() { return this._running }

  start(): void {
    if (this._destroyed || this._running) return
    this._running = true
    if (idleManager.isIdle && this.mode === 'throttle') {
      this.startThrottled()
    } else if (!idleManager.isIdle) {
      this.lastTime = null
      this.scheduleRAF()
    }
  }

  stop(): void {
    this._running = false
    this.cancelAll()
  }

  destroy(): void {
    this._destroyed = true
    this.stop()
    this.unregister?.()
    this.unregister = null
  }

  private handlePause(): void {
    this.cancelAll()
    if (this.mode === 'throttle' && this._running) {
      this.startThrottled()
    }
  }

  private handleResume(): void {
    this.cancelAll()
    if (this._running) {
      this.lastTime = null
      this.scheduleRAF()
    }
  }

  private scheduleRAF(): void {
    if (!this._running || this._destroyed) return
    this.rafId = requestAnimationFrame((ts) => {
      this.rafId = null
      const dt = this.lastTime !== null ? ts - this.lastTime : 0
      this.lastTime = ts
      this.cb(ts, dt)
      this.scheduleRAF()
    })
  }

  private startThrottled(): void {
    this.timerId = setInterval(() => {
      const ts = performance.now()
      const dt = this.lastTime !== null ? ts - this.lastTime : 0
      this.lastTime = ts
      this.cb(ts, dt)
    }, this.throttleMs)
  }

  private cancelAll(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    if (this.timerId !== null) {
      clearInterval(this.timerId)
      this.timerId = null
    }
  }
}
