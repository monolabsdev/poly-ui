import { idleManager } from './manager'

interface SyncConfig {
  onSync: () => Promise<void>
  onPause?: () => void
  onResume?: () => void
  intervalMs?: number
  id?: string
}

export class PauseableDBSync {
  private timer: ReturnType<typeof setInterval> | null = null
  private syncing = false
  private needsFullSync = false
  private unregister: (() => void) | null = null
  private _destroyed = false
  private _running = false

  constructor(private config: SyncConfig) {
    this.unregister = idleManager.register(config.id ?? 'db-sync', {
      onPause: () => {
        this.stopTimer()
        this.config.onPause?.()
      },
      onResume: () => {
        this.startTimer()
        this.config.onResume?.()
        this.needsFullSync = true
      },
    })
    this.startTimer()
  }

  async sync(): Promise<void> {
    if (this.syncing) return
    this.syncing = true
    try {
      await this.config.onSync()
    } finally {
      this.syncing = false
    }
  }

  get running() { return this._running }

  private startTimer(): void {
    if (this._destroyed) return
    if (this._running) return
    if (idleManager.isIdle) return
    const ms = this.config.intervalMs ?? 30000
    this._running = true
    this.timer = setInterval(async () => {
      if (this.needsFullSync) {
        this.needsFullSync = false
        await this.sync()
      }
    }, ms)
  }

  private stopTimer(): void {
    if (!this._running) return
    this._running = false
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  destroy(): void {
    this._destroyed = true
    this.stopTimer()
    this.unregister?.()
    this.unregister = null
  }
}

export function idleBlock<T>(fn: () => Promise<T>): Promise<T> {
  const unblock = idleManager.blockIdle()
  return fn().finally(unblock)
}

export async function criticalWrite<T>(fn: () => Promise<T>): Promise<T> {
  const unblock = idleManager.blockIdle()
  try {
    return await fn()
  } finally {
    unblock()
  }
}
