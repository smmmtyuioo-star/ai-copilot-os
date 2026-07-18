'use client'

export interface StreamSession {
  id: string
  conversationId: string
  userMessageId: string
  userMessageContent: string
  model: string
  history: { role: string; content: string }[]
  partialContent: string
  startedAt: string
  updatedAt: string
  status: 'streaming' | 'completed' | 'cancelled' | 'disconnected'
}

const STORAGE_KEY = 'ac_stream_session'

export function saveStreamSession(session: StreamSession): void {
  if (typeof window === 'undefined') return
  try {
    session.updatedAt = new Date().toISOString()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch (e) {
    console.error('stream-session: failed to save', e)
  }
}

export function loadStreamSession(): StreamSession | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const session = JSON.parse(raw) as StreamSession
    if (session.status !== 'streaming') return null
    if (Date.now() - new Date(session.updatedAt).getTime() > 5 * 60 * 1000) {
      clearStreamSession()
      return null
    }
    return session
  } catch {
    return null
  }
}

export function clearStreamSession(): void {
  if (typeof window === 'undefined') return
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* noop */ }
}

export function updateStreamContent(partial: string): void {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const session = JSON.parse(raw) as StreamSession
    session.partialContent = partial
    session.updatedAt = new Date().toISOString()
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch { /* noop */ }
}
