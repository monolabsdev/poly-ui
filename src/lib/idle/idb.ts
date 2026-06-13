import { idleManager } from './manager'

type UpgradeHandler = (db: IDBDatabase, oldVersion: number, newVersion: number | null) => void

interface PauseableIDBOpts {
  version?: number
  upgrade?: UpgradeHandler
  id?: string
  clearStores?: string[]
  deleteOnIdle?: boolean
}

export class PauseableIDB {
  private db: IDBDatabase | null = null
  private openPromise: Promise<IDBDatabase> | null = null
  private unregister: (() => void) | null = null
  private _closed = false
  private closePromise: Promise<void> | null = null

  constructor(
    private name: string,
    private opts: PauseableIDBOpts = {},
  ) {
    this.unregister = idleManager.register(opts.id ?? `idb:${name}`, {
      onPause: () => { this.handlePause() },
      onResume: () => { this.handleResume() },
    })
  }

  get closed() { return this._closed }

  async getDB(): Promise<IDBDatabase> {
    if (this.closePromise) await this.closePromise
    if (this.db && !this._closed) return this.db
    if (this.openPromise) return this.openPromise
    this.openPromise = this.open()
    try { this.db = await this.openPromise; return this.db }
    finally { this.openPromise = null }
  }

  close(): void {
    this._closed = true
    if (this.opts.deleteOnIdle) {
      this.db?.close()
      this.db = null
      indexedDB.deleteDatabase(this.name)
    } else {
      this.db?.close()
      this.db = null
    }
  }

  destroy(): void {
    this.close()
    this.unregister?.()
    this.unregister = null
  }

  private async handlePause(): Promise<void> {
    if (!this.db) return
    const stores = this.opts.clearStores
    if (stores && stores.length > 0) {
      this.closePromise = this.clearAndClose(stores)
      await this.closePromise
      this.closePromise = null
      return
    }
    this.close()
  }

  private handleResume(): void {
    this._closed = false
    this.openPromise = null
  }

  private clearAndClose(stores: string[]): Promise<void> {
    return new Promise((resolve) => {
      const db = this.db
      if (!db) { resolve(); return }
      const tx = db.transaction(stores, 'readwrite')
      for (const s of stores) {
        try { tx.objectStore(s).clear() } catch {}
      }
      tx.oncomplete = () => { db.close(); this.db = null; this._closed = true; resolve() }
      tx.onerror = () => { db.close(); this.db = null; this._closed = true; resolve() }
    })
  }

  private open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.name, this.opts.version)
      req.onupgradeneeded = (e) => {
        this.opts.upgrade?.(req.result, e.oldVersion, e.newVersion)
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
}

export function withIDB<T>(idb: PauseableIDB, fn: (db: IDBDatabase) => Promise<T>): Promise<T> {
  const unblock = idleManager.blockIdle()
  return idb.getDB().then(fn).finally(unblock)
}
