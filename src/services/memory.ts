import { getSupabase } from '@/database/client'
import { localStore, hasSupabase } from '@/lib/storage'
import type { MemoryEntry } from '@/types'
import { generateId, parseError } from '@/lib/utils'

export async function storeMemory(userId: string, content: string, type: 'short-term' | 'long-term', metadata?: Record<string, unknown>): Promise<MemoryEntry> {
  const entry: MemoryEntry = {
    id: generateId(), user_id: userId, type, content,
    metadata: metadata || {}, created_at: new Date().toISOString(),
  }
  if (hasSupabase) {
    const supabase = getSupabase()
    if (supabase) {
      const { error } = await supabase.from('memory').insert(entry)
      if (error) throw new Error(error.message)
      return entry
    }
  }
  localStore.memories.add({ id: entry.id, content: entry.content, type: entry.type, createdAt: entry.created_at })
  return entry
}

export async function getRecentMemory(userId: string, limit = 50): Promise<MemoryEntry[]> {
  if (hasSupabase) {
    const supabase = getSupabase()
    if (supabase) {
      const { data, error } = await supabase.from('memory').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(limit)
      if (!error && data) return data
    }
  }
  return localStore.memories.items.slice(0, limit).map(m => ({
    id: m.id, user_id: userId, type: (m.type || 'short-term') as 'short-term' | 'long-term',
    content: m.content, metadata: {}, created_at: m.createdAt,
  }))
}

export async function searchMemory(userId: string, query: string, type?: 'short-term' | 'long-term'): Promise<MemoryEntry[]> {
  if (hasSupabase) {
    const supabase = getSupabase()
    if (supabase) {
      let q = supabase.from('memory').select('*').eq('user_id', userId).textSearch('content', query)
      if (type) q = q.eq('type', type)
      const { data, error } = await q.order('created_at', { ascending: false }).limit(20)
      if (!error && data) return data
    }
  }
  const items = localStore.memories.items.filter(m => {
    if (type && m.type !== type) return false
    return m.content.toLowerCase().includes(query.toLowerCase())
  })
  return items.map(m => ({
    id: m.id, user_id: userId, type: (m.type || 'short-term') as 'short-term' | 'long-term',
    content: m.content, metadata: {}, created_at: m.createdAt,
  }))
}

export async function deleteMemory(id: string): Promise<void> {
  if (hasSupabase) {
    const supabase = getSupabase()
    if (supabase) { await supabase.from('memory').delete().eq('id', id); return }
  }
  localStore.memories.remove(id)
}

export async function clearMemory(userId: string, type?: 'short-term' | 'long-term'): Promise<void> {
  if (hasSupabase) {
    const supabase = getSupabase()
    if (supabase) {
      let q = supabase.from('memory').delete().eq('user_id', userId)
      if (type) q = q.eq('type', type)
      await q
      return
    }
  }
  if (type) {
    localStore.memories.items.filter(m => m.type === type).forEach(m => localStore.memories.remove(m.id))
  } else {
    localStore.memories.items.forEach(m => localStore.memories.remove(m.id))
  }
}
