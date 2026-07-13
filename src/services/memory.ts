import { getSupabase } from '@/database/client'
import type { MemoryEntry } from '@/types'
import { generateId, parseError } from '@/lib/utils'

function getClient() {
  const c = getSupabase()
  if (!c) throw new Error('Supabase client not available. Check your environment variables.')
  return c
}

export async function storeMemory(
  userId: string,
  content: string,
  type: 'short-term' | 'long-term',
  metadata?: Record<string, unknown>,
): Promise<MemoryEntry> {
  const supabase = getClient()
  const entry: MemoryEntry = {
    id: generateId(),
    user_id: userId,
    type,
    content,
    metadata: metadata || {},
    created_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('memory').insert(entry)
  if (error) throw new Error(error.message)
  return entry
}

export async function getRecentMemory(userId: string, limit = 50): Promise<MemoryEntry[]> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('memory')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) throw new Error(error.message)
  return data || []
}

export async function searchMemory(
  userId: string,
  query: string,
  type?: 'short-term' | 'long-term',
): Promise<MemoryEntry[]> {
  const supabase = getClient()
  let q = supabase
    .from('memory')
    .select('*')
    .eq('user_id', userId)
    .textSearch('content', query)
  if (type) q = q.eq('type', type)
  const { data, error } = await q.order('created_at', { ascending: false }).limit(20)
  if (error) throw new Error(error.message)
  return data || []
}

export async function deleteMemory(id: string): Promise<void> {
  const supabase = getClient()
  const { error } = await supabase.from('memory').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function clearMemory(userId: string, type?: 'short-term' | 'long-term'): Promise<void> {
  const supabase = getClient()
  let q = supabase.from('memory').delete().eq('user_id', userId)
  if (type) q = q.eq('type', type)
  const { error } = await q
  if (error) throw new Error(error.message)
}
