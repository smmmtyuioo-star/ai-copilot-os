import fs from 'fs'
import path from 'path'

type CollectionKey = 'users' | 'sessions' | 'mcpEndpoints' | 'apiKeys' | 'conversations' | 'messages' | 'agents' | 'memories' | 'promptRecords' | 'documents' | 'resetTokens'

const DATA_DIR = path.join(process.cwd(), '.data')

function ensureDir() {
  if (!fs.existsSync(DATA_DIR)) {
    try { fs.mkdirSync(DATA_DIR, { recursive: true }) } catch { /* noop */ }
  }
}

function getFilePath(key: CollectionKey): string {
  return path.join(DATA_DIR, `${key}.json`)
}

function readCollection(key: CollectionKey): any[] {
  ensureDir()
  const filePath = getFilePath(key)
  try {
    if (!fs.existsSync(filePath)) return []
    const raw = fs.readFileSync(filePath, 'utf8')
    if (!raw.trim()) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function writeCollection(key: CollectionKey, items: any[]): void {
  ensureDir()
  const filePath = getFilePath(key)
  try {
    fs.writeFileSync(filePath, JSON.stringify(items, null, 2), 'utf8')
  } catch (err) {
    console.error(`server-store: failed to write ${key}:`, err)
  }
}

export interface ServerStore {
  list: (key: CollectionKey) => any[]
  get: (key: CollectionKey) => any[]
  getById: (key: CollectionKey, id: string) => any | undefined
  add: (key: CollectionKey, item: any) => void
  update: (key: CollectionKey, id: string, updates: any) => void
  remove: (key: CollectionKey, id: string) => void
}

let _store: ServerStore | null = null

export function getServerStore(): ServerStore {
  if (_store) return _store
  _store = {
    list: (key) => readCollection(key),
    get: (key) => readCollection(key),
    getById: (key, id) => readCollection(key).find((i: any) => i.id === id),
    add: (key, item) => {
      const items = readCollection(key)
      items.push(item)
      writeCollection(key, items)
    },
    update: (key, id, updates) => {
      const items = readCollection(key)
      const idx = items.findIndex((i: any) => i.id === id)
      if (idx >= 0) {
        items[idx] = { ...items[idx], ...updates }
        writeCollection(key, items)
      }
    },
    remove: (key, id) => {
      const items = readCollection(key).filter((i: any) => i.id !== id)
      writeCollection(key, items)
    },
  }
  return _store
}
