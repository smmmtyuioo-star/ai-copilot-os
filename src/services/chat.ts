import { getSupabase } from '@/database/client'
import { localStore, hasSupabase } from '@/lib/storage'
import type { Conversation, Message } from '@/types'
import { parseError, generateId } from '@/lib/utils'

export async function createConversation(userId: string, title: string, model?: string): Promise<Conversation> {
  const conversation: Conversation = {
    id: generateId(), user_id: userId, title,
    model: model || 'llama-3.3-70b-versatile',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }
  if (hasSupabase) {
    const supabase = getSupabase()
    if (supabase) {
      const { error } = await supabase.from('conversations').insert(conversation)
      if (error) throw new Error(error.message)
      return conversation
    }
  }
  localStore.conversations.add({ id: conversation.id, title: conversation.title, model: conversation.model, createdAt: conversation.created_at })
  return conversation
}

export async function getConversations(userId: string): Promise<Conversation[]> {
  if (hasSupabase) {
    const supabase = getSupabase()
    if (supabase) {
      const { data, error } = await supabase.from('conversations').select('*').eq('user_id', userId).order('updated_at', { ascending: false })
      if (!error && data) return data
    }
  }
  return localStore.conversations.items.map(c => ({
    id: c.id, user_id: userId, title: c.title, model: c.model,
    created_at: c.createdAt, updated_at: c.createdAt,
  }))
}

export async function getConversation(id: string): Promise<Conversation | null> {
  if (hasSupabase) {
    const supabase = getSupabase()
    if (supabase) {
      const { data } = await supabase.from('conversations').select('*').eq('id', id).single()
      if (data) return data
    }
  }
  const c = localStore.conversations.getById(id)
  if (!c) return null
  return { id: c.id, user_id: 'local', title: c.title, model: c.model, created_at: c.createdAt, updated_at: c.createdAt }
}

export async function deleteConversation(id: string): Promise<void> {
  if (hasSupabase) {
    const supabase = getSupabase()
    if (supabase) { await supabase.from('conversations').delete().eq('id', id); return }
  }
  localStore.conversations.remove(id)
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  if (hasSupabase) {
    const supabase = getSupabase()
    if (supabase) {
      const { data, error } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true })
      if (!error && data) return data
    }
  }
  return localStore.messages.items
    .filter(m => m.conversationId === conversationId)
    .map(m => ({ id: m.id, conversation_id: m.conversationId, role: m.role as Message['role'], content: m.content, created_at: m.createdAt }))
}

export async function saveMessage(message: Omit<Message, 'created_at'>, credentialId?: string): Promise<Message> {
  const msg: Message = { ...message, created_at: new Date().toISOString() }
  if (hasSupabase) {
    const supabase = getSupabase()
    if (supabase) {
      const { error } = await supabase.from('messages').insert(msg)
      if (error) throw new Error(error.message)
      return msg
    }
  }
  localStore.messages.add({ id: msg.id, conversationId: msg.conversation_id, role: msg.role, content: msg.content, createdAt: msg.created_at, credentialId })
  return msg
}

export async function streamAiResponse(
  messages: { role: string; content: string }[],
  model?: string,
  onToken?: (token: string) => void,
  onError?: (error: string) => void,
): Promise<string> {
  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model: model || 'llama-3.3-70b-versatile' }),
    })

    if (!response.ok) {
      const err = await response.json()
      onError?.(err.error || 'Failed to get AI response')
      return ''
    }

    if (!response.body) {
      onError?.('No response body')
      return ''
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
      for (const line of lines) {
        const data = line.slice(6)
        if (data === '[DONE]') break
        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content || ''
          if (content) {
            fullContent += content
            onToken?.(content)
          }
        } catch {}
      }
    }

    return fullContent
  } catch (err) {
    onError?.(parseError(err))
    return ''
  }
}
