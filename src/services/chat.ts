import { getSupabase } from '@/database/client'
import type { Conversation, Message } from '@/types'
import { parseError, generateId } from '@/lib/utils'

function getClient() {
  const c = getSupabase()
  if (!c) throw new Error('Supabase client not available. Check your environment variables.')
  return c
}

export async function createConversation(userId: string, title: string, model?: string): Promise<Conversation> {
  const supabase = getClient()
  const conversation: Conversation = {
    id: generateId(),
    user_id: userId,
    title,
    model: model || 'gpt-4o',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('conversations').insert(conversation)
  if (error) throw new Error(error.message)
  return conversation
}

export async function getConversations(userId: string): Promise<Conversation[]> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data || []
}

export async function getConversation(id: string): Promise<Conversation | null> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('conversations')
    .select('*')
    .eq('id', id)
    .single()
  if (error) return null
  return data
}

export async function deleteConversation(id: string): Promise<void> {
  const supabase = getClient()
  const { error } = await supabase.from('conversations').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export async function getMessages(conversationId: string): Promise<Message[]> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })
  if (error) throw new Error(error.message)
  return data || []
}

export async function saveMessage(message: Omit<Message, 'created_at'>): Promise<Message> {
  const supabase = getClient()
  const msg: Message = {
    ...message,
    created_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('messages').insert(msg)
  if (error) throw new Error(error.message)
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
      body: JSON.stringify({ messages, model: model || 'gpt-4o' }),
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
        } catch {
          // skip parse errors
        }
      }
    }

    return fullContent
  } catch (err) {
    onError?.(parseError(err))
    return ''
  }
}
