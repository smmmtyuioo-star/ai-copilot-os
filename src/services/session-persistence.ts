interface SessionSnapshot {
  id: string
  userId: string
  type: 'conversation' | 'workflow' | 'agent-state' | 'full'
  data: Record<string, unknown>
  createdAt: string
  version: number
}

interface SessionRecord {
  id: string
  name: string
  userId: string
  messages: { role: string; content: string; createdAt: string }[]
  workflowState?: Record<string, unknown>
  agentStates?: Record<string, unknown>
  metadata: Record<string, unknown>
  createdAt: string
  updatedAt: string
  lastModel: string
}

class SessionPersistence {
  private dbName = 'ac_session_db'
  private dbVersion = 1
  private db: IDBDatabase | null = null
  private ready: Promise<void>

  constructor() {
    this.ready = this.init()
  }

  private async init(): Promise<void> {
    if (typeof window === 'undefined') return
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(this.dbName, this.dbVersion)
      req.onupgradeneeded = (ev) => {
        const db = (ev.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains('sessions')) {
          db.createObjectStore('sessions', { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains('snapshots')) {
          const ss = db.createObjectStore('snapshots', { keyPath: 'id' })
          ss.createIndex('sessionId', 'sessionId', { unique: false })
          ss.createIndex('type', 'type', { unique: false })
        }
        if (!db.objectStoreNames.contains('messages')) {
          const ms = db.createObjectStore('messages', { keyPath: 'id' })
          ms.createIndex('sessionId', 'sessionId', { unique: false })
          ms.createIndex('createdAt', 'createdAt', { unique: false })
        }
        if (!db.objectStoreNames.contains('state')) {
          db.createObjectStore('state', { keyPath: 'key' })
        }
      }
      req.onsuccess = () => { this.db = req.result; resolve() }
      req.onerror = () => reject(req.error)
    })
  }

  private async ensureReady(): Promise<IDBDatabase> {
    await this.ready
    if (!this.db) throw new Error('IndexedDB not available')
    return this.db
  }

  private async transact<T>(
    storeName: string,
    mode: IDBTransactionMode,
    fn: (store: IDBObjectStore) => IDBRequest<T>
  ): Promise<T> {
    const db = await this.ensureReady()
    return new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, mode)
      const req = fn(tx.objectStore(storeName))
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
      tx.oncomplete = () => { if (!req.result) resolve(undefined as unknown as T) }
    })
  }

  async saveSession(session: SessionRecord): Promise<void> {
    session.updatedAt = new Date().toISOString()
    await this.transact('sessions', 'readwrite', (store) => store.put(session))
    const snapshots = JSON.parse(localStorage.getItem('ac_session_index') || '[]') as string[]
    if (!snapshots.includes(session.id)) {
      snapshots.push(session.id)
      localStorage.setItem('ac_session_index', JSON.stringify(snapshots))
    }
  }

  async getSession(id: string): Promise<SessionRecord | undefined> {
    return this.transact('sessions', 'readonly', (store) => store.get(id))
  }

  async listSessions(userId?: string): Promise<SessionRecord[]> {
    const db = await this.ensureReady()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('sessions', 'readonly')
      const req = tx.objectStore('sessions').getAll()
      req.onsuccess = () => {
        let sessions = req.result as SessionRecord[]
        if (userId) sessions = sessions.filter(s => s.userId === userId)
        resolve(sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()))
      }
      req.onerror = () => reject(req.error)
    })
  }

  async deleteSession(id: string): Promise<void> {
    await this.transact('sessions', 'readwrite', (store) => store.delete(id))
    const snapshots = JSON.parse(localStorage.getItem('ac_session_index') || '[]') as string[]
    const idx = snapshots.indexOf(id)
    if (idx >= 0) { snapshots.splice(idx, 1); localStorage.setItem('ac_session_index', JSON.stringify(snapshots)) }
  }

  async saveSnapshot(snapshot: SessionSnapshot): Promise<void> {
    await this.transact('snapshots', 'readwrite', (store) => store.put(snapshot))
  }

  async getSnapshots(sessionId: string): Promise<SessionSnapshot[]> {
    const db = await this.ensureReady()
    return new Promise((resolve, reject) => {
      const tx = db.transaction('snapshots', 'readonly')
      const idx = tx.objectStore('snapshots').index('sessionId')
      const req = idx.getAll(IDBKeyRange.only(sessionId))
      req.onsuccess = () => resolve(req.result as SessionSnapshot[])
      req.onerror = () => reject(req.error)
    })
  }

  async saveState(key: string, value: unknown): Promise<void> {
    await this.transact('state', 'readwrite', (store) => store.put({ key, value, updatedAt: new Date().toISOString() }))
  }

  async getState<T>(key: string): Promise<T | undefined> {
    const record = await this.transact<{ key: string; value: T } | undefined>('state', 'readonly', (store) => store.get(key))
    return record?.value
  }

  async clearState(): Promise<void> {
    const db = await this.ensureReady()
    const tx = db.transaction('state', 'readwrite')
    tx.objectStore('state').clear()
  }

  async resumeSession(userId: string): Promise<SessionRecord | null> {
    const sessions = await this.listSessions(userId)
    return sessions[0] || null
  }

  async captureSnapshot(sessionId: string, userId: string, data: Record<string, unknown>, type: SessionSnapshot['type'] = 'full'): Promise<void> {
    const snapshots = await this.getSnapshots(sessionId)
    await this.saveSnapshot({
      id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      userId,
      type,
      data,
      createdAt: new Date().toISOString(),
      version: snapshots.length + 1,
    })
  }
}

export const sessionPersistence = new SessionPersistence()
