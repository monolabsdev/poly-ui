import { idleManager } from './manager'

interface PauseableWebSocketOptions {
  url: string | (() => string)
  protocols?: string | string[]
  reconnectDelay?: number
  maxReconnects?: number
  onMessage: (data: MessageEvent) => void
  onError?: (err: Event) => void
  onOpen?: () => void
  onClose?: (wasClean: boolean) => void
  id?: string
  keepAlivePingMs?: number
}

export class PauseableWebSocket {
  private ws: WebSocket | null = null
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private pingTimer: ReturnType<typeof setInterval> | null = null
  private intentionalClose = false
  private _connected = false
  private unregister: (() => void) | null = null
  private _destroyed = false

  private url: string | (() => string)
  private protocols: string | string[] | undefined
  private reconnectDelay: number
  private maxReconnects: number
  private keepAlivePingMs: number
  private _onMessage: (data: MessageEvent) => void
  private _onError?: (err: Event) => void
  private _onOpen?: () => void
  private _onClose?: (wasClean: boolean) => void

  constructor(opts: PauseableWebSocketOptions) {
    this.url = opts.url
    this.protocols = opts.protocols
    this.reconnectDelay = opts.reconnectDelay ?? 3000
    this.maxReconnects = opts.maxReconnects ?? 10
    this.keepAlivePingMs = opts.keepAlivePingMs ?? 30000
    this._onMessage = opts.onMessage
    this._onError = opts.onError
    this._onOpen = opts.onOpen
    this._onClose = opts.onClose
    this.unregister = idleManager.register(opts.id ?? 'ws-default', {
      onPause: () => this.onIdlePause(),
      onResume: () => this.onIdleResume(),
    })
  }

  get connected() { return this._connected }

  connect(): void {
    if (this._destroyed) return
    if (idleManager.isIdle) return
    if (this._connected) return

    const url = typeof this.url === 'function' ? this.url() : this.url
    this.intentionalClose = false

    try {
      this.ws = new WebSocket(url, this.protocols)
    } catch (err) {
      this._onError?.(err as Event)
      this.scheduleReconnect()
      return
    }

    this.ws.onopen = () => {
      if (this._destroyed) { this.ws?.close(); return }
      this._connected = true
      this.reconnectAttempts = 0
      this._onOpen?.()
      this.startPing()
    }

    this.ws.onmessage = (data) => {
      this._onMessage(data)
    }

    this.ws.onerror = (err) => {
      this._onError?.(err)
    }

    this.ws.onclose = (e) => {
      this._connected = false
      this.stopPing()
      if (!this.intentionalClose && !this._destroyed) {
        this.scheduleReconnect()
      }
      this._onClose?.(e.wasClean)
      this.ws = null
    }
  }

  disconnect(): void {
    this.intentionalClose = true
    this.ws?.close(1000, 'client disconnect')
    this.ws = null
    this._connected = false
    this.clearReconnect()
    this.stopPing()
  }

  send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    if (this._connected && this.ws) {
      this.ws.send(data)
    }
  }

  destroy(): void {
    this._destroyed = true
    this.disconnect()
    this.unregister?.()
    this.unregister = null
  }

  private onIdlePause(): void {
    this.intentionalClose = true
    this.ws?.close(1000, 'idle')
    this.ws = null
    this._connected = false
    this.clearReconnect()
    this.stopPing()
  }

  private onIdleResume(): void {
    this.intentionalClose = false
    this.connect()
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnects) return
    this.clearReconnect()
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, this.reconnectDelay * this.reconnectAttempts)
  }

  private clearReconnect(): void {
    if (this.reconnectTimer !== null) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private startPing(): void {
    this.stopPing()
    this.pingTimer = setInterval(() => {
      if (this._connected && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send('ping')
      }
    }, this.keepAlivePingMs)
  }

  private stopPing(): void {
    if (this.pingTimer !== null) {
      clearInterval(this.pingTimer)
      this.pingTimer = null
    }
  }
}
