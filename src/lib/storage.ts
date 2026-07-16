// Local storage abstraction — works without Supabase
// Falls back to in-memory/localStorage when Supabase is not configured

import { env } from '@/config/env'

const hasSupabase = !!(env.supabase.url && env.supabase.anonKey)

interface Store<T> {
  items: T[]
  getById: (id: string) => T | undefined
  add: (item: T) => void
  update: (id: string, item: Partial<T>) => void
  remove: (id: string) => void
}

function createStore<T extends { id: string }>(key: string): Store<T> {
  const getItems = (): T[] => {
    if (typeof window === 'undefined') return []
    try {
      const data = localStorage.getItem(`ac_${key}`)
      return data ? JSON.parse(data) : []
    } catch (e) { console.error(`Storage: failed to read ac_${key}:`, e); return [] }
  }

  const saveItems = (items: T[]) => {
    if (typeof window === 'undefined') return
    try { localStorage.setItem(`ac_${key}`, JSON.stringify(items)) } catch (e) { console.error(`Storage: failed to write ac_${key}:`, e) }
  }

  return {
    get items() { return getItems() },
    getById(id: string) { return getItems().find(i => i.id === id) },
    add(item: T) {
      const items = getItems()
      items.push(item)
      saveItems(items)
    },
    update(id: string, updates: Partial<T>) {
      const items = getItems()
      const idx = items.findIndex(i => i.id === id)
      if (idx >= 0) {
        items[idx] = { ...items[idx], ...updates }
        saveItems(items)
      }
    },
    remove(id: string) {
      saveItems(getItems().filter(i => i.id !== id))
    },
  }
}

export const localStore = {
  conversations: createStore<{ id: string; title: string; model: string; createdAt: string }>('convs'),
  messages: createStore<{ id: string; conversationId: string; role: string; content: string; createdAt: string; credentialId?: string }>('msgs'),
  agents: createStore<{ id: string; name: string; role: string; model: string; systemPrompt: string; tools: string[] }>('agents'),
  memories: createStore<{ id: string; content: string; type: string; createdAt: string }>('mem'),

  apiKeys: createStore<{ id: string; name: string; key: string; provider?: string; createdAt: string; updatedAt?: string }>('apikeys'),
  mcpEndpoints: createStore<{ id: string; name: string; url: string; protocol: string; status: string; createdAt: string }>('mcp'),
  profile: createStore<{ id: string; key: string; value: string; updatedAt: string }>('profile'),
}

export { hasSupabase }
