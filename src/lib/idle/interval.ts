import { idleManager } from './manager'

interface PauseableIntervalCallbacks {
  onTick: () => void
  onPause?: () => void
  onResume?: () => void
}

export class PauseableInterval {
  private timer: ReturnType<typeof setInterval> | null = null
  private lastRun = Date.now()
  private unregister: (() => void) | null = null
  private _running = false

  constructor(
    _id: string,
    private ms: number,
    private cb: PauseableIntervalCallbacks,
    private opts?: { immediateOnResume?: boolean },
  ) {
    this.unregister = idleManager.register(_id, {
      onPause: () => {
        this.stop()
        this.cb.onPause?.()
      },
      onResume: () => {
        this.cb.onResume?.()
        if (this.opts?.immediateOnResume) {
          const elapsed = Date.now() - this.lastRun
          if (elapsed >= this.ms * 1.5) {
            this.cb.onTick()
            this.lastRun = Date.now()
          }
        }
        this.start()
      },
    })
  }

  get running() { return this._running }

  start(): void {
    if (this._running) return
    if (idleManager.isIdle) return
    this._running = true
    this.timer = setInterval(() => {
      this.cb.onTick()
      this.lastRun = Date.now()
    }, this.ms)
  }

  stop(): void {
    if (!this._running) return
    this._running = false
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  runNow(): void {
    this.cb.onTick()
    this.lastRun = Date.now()
  }

  destroy(): void {
    this.stop()
    this.unregister?.()
    this.unregister = null
  }
}
