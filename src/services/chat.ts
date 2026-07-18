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
  signal?: AbortSignal,
): Promise<string> {
  const _startTime = Date.now()
  const _modelToUse = model || 'llama-3.3-70b-versatile'
  try {
    let mcpEndpoints: any[] = []
    if (hasSupabase) {
      const supabase = getSupabase()
      if (supabase) {
        const { data } = await supabase.from('mcp_endpoints').select('*')
        if (data) mcpEndpoints = data
      }
    } else {
      mcpEndpoints = localStore.mcpEndpoints.items
    }

    // Default built-in tools
    const tools = ['web_search', 'github_action', 'safe_browsing', 'search_memory', 'execute_code', 'shell', 'edit', 'write', 'preview']

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages, model: _modelToUse, mcpEndpoints, tools }),
      signal: signal || AbortSignal.timeout(60000),
    })

    if (!response.ok) {
      const err = await response.json()
      onError?.(err.error || 'Failed to get AI response')
      _logPromptRecord({ messages, model: _modelToUse, mcpEndpoints, tools, error: err.error, success: false, startTime: _startTime })
      return ''
    }

    if (!response.body) {
      onError?.('No response body')
      _logPromptRecord({ messages, model: _modelToUse, mcpEndpoints, tools, error: 'No response body', success: false, startTime: _startTime })
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
        } catch (e) { console.error('Chat stream: failed to parse SSE chunk:', e) }
      }
    }

    _logPromptRecord({ messages, model: _modelToUse, mcpEndpoints, tools, responseContent: fullContent, success: true, startTime: _startTime })
    return fullContent
  } catch (err) {
    const errMsg = parseError(err)
    onError?.(errMsg)
    _logPromptRecord({ messages, model: _modelToUse, mcpEndpoints: [], tools: [], error: errMsg, success: false, startTime: _startTime })
    return ''
  }
}

async function _logPromptRecord(opts: {
  messages: any[]; model: string; mcpEndpoints?: any[]; tools?: string[];
  responseContent?: string; error?: string; success: boolean; startTime: number
}) {
  try {
    await fetch('/api/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'chat',
        model: opts.model,
        messages: opts.messages,
        mcpEndpoints: opts.mcpEndpoints || [],
        tools: opts.tools || [],
        responseContent: opts.responseContent || '',
        success: opts.success,
        error: opts.error || '',
        durationMs: Date.now() - opts.startTime,
      }),
      signal: AbortSignal.timeout(2000),
    })
  } catch { /* background log — no need to surface */ }
}
