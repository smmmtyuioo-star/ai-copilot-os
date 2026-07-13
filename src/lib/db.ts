// Unified database layer — uses Supabase when available, localStorage otherwise
import { getSupabase } from '@/database/client'
import { localStore, hasSupabase } from './storage'
import { generateId } from './utils'
import type { Conversation, Message, Agent, MemoryEntry } from '@/types'

export const db = {
  hasSupabase,

  async getConversations(userId?: string): Promise<Conversation[]> {
    if (hasSupabase) {
      const supabase = getSupabase()
      if (!supabase) return localStore.conversations.items as unknown as Conversation[]
      const { data } = await supabase.from('conversations').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
      return data || []
    }
    return localStore.conversations.items.map(c => ({
      id: c.id,
      user_id: userId || 'local',
      title: c.title,
      model: c.model || 'llama-3.3-70b-versatile',
      created_at: c.createdAt,
      updated_at: c.createdAt,
    }))
  },

  async addConversation(conv: Conversation): Promise<void> {
    if (hasSupabase) {
      const supabase = getSupabase()
      if (supabase) { await supabase.from('conversations').insert(conv); return }
    }
    localStore.conversations.add({ id: conv.id, title: conv.title, model: conv.model, createdAt: conv.created_at })
  },

  async deleteConversation(id: string): Promise<void> {
    if (hasSupabase) {
      const supabase = getSupabase()
      if (supabase) { await supabase.from('conversations').delete().eq('id', id); return }
    }
    localStore.conversations.remove(id)
  },

  async getMessages(conversationId: string): Promise<Message[]> {
    if (hasSupabase) {
      const supabase = getSupabase()
      if (!supabase) return localStore.messages.items.filter(m => m.conversationId === conversationId) as unknown as Message[]
      const { data } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true })
      return data || []
    }
    return localStore.messages.items
      .filter(m => m.conversationId === conversationId)
      .map(m => ({ id: m.id, conversation_id: m.conversationId, role: m.role as 'user' | 'assistant', content: m.content, created_at: m.createdAt }))
  },

  async addMessage(msg: Message): Promise<void> {
    if (hasSupabase) {
      const supabase = getSupabase()
      if (supabase) { await supabase.from('messages').insert(msg); return }
    }
    localStore.messages.add({
      id: msg.id, conversationId: msg.conversation_id,
      role: msg.role, content: msg.content, createdAt: msg.created_at,
    })
  },

  async getAgents(): Promise<Agent[]> {
    if (hasSupabase) {
      const supabase = getSupabase()
      if (supabase) { const { data } = await supabase.from('agents').select('*'); return data || [] }
    }
    return localStore.agents.items.map(a => ({
      id: a.id, user_id: 'local', name: a.name, role: a.role as Agent['role'],
      model: a.model, system_prompt: a.systemPrompt, tools: a.tools,
      status: 'idle' as const, created_at: '',
    }))
  },

  async addMemory(entry: MemoryEntry): Promise<void> {
    if (hasSupabase && getSupabase()) {
      const supabase = getSupabase()!
      await supabase.from('memory').insert(entry)
      return
    }
    localStore.memories.add({ id: entry.id, content: entry.content, type: entry.type, createdAt: entry.created_at })
  },

  async getMemories(): Promise<MemoryEntry[]> {
    if (hasSupabase) {
      const supabase = getSupabase()
      if (supabase) { const { data } = await supabase.from('memory').select('*').order('created_at', { ascending: false }); return data || [] }
    }
    return localStore.memories.items.map(m => ({
      id: m.id, user_id: 'local', type: m.type as 'short-term' | 'long-term',
      content: m.content, metadata: {}, created_at: m.createdAt,
    }))
  },
}
