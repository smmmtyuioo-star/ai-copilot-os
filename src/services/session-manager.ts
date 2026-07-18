import { emit, Events } from '@/services/event-bus'
import { generateId } from '@/lib/utils'

interface SessionMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolCalls?: any[]
  toolResult?: string
  timestamp: string
}

interface Session {
  id: string
  userId: string
  title: string
  model: string
  messages: SessionMessage[]
  systemPrompt?: string
  createdAt: string
  updatedAt: string
  summary?: string
  parentId?: string
  metadata: Record<string, any>
}

interface SessionSnapshot {
  id: string
  sessionId: string
  messages: SessionMessage[]
  timestamp: string
  label: string
}

const STORAGE_KEY_PREFIX = 'ac_sessions_'
const SNAPSHOT_KEY_PREFIX = 'ac_snapshots_'
const ACTIVE_KEY = 'ac_active_session'

function sessionsKey(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`
}

function snapshotKey(sessionId: string): string {
  return `${SNAPSHOT_KEY_PREFIX}${sessionId}`
}

function loadSessions(userId: string): Session[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(sessionsKey(userId)) || '[]')
  } catch { return [] }
}

function saveSessions(userId: string, sessions: Session[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(sessionsKey(userId), JSON.stringify(sessions))
}

function loadSnapshots(sessionId: string): SessionSnapshot[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(snapshotKey(sessionId)) || '[]')
  } catch { return [] }
}

function saveSnapshots(sessionId: string, snapshots: SessionSnapshot[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(snapshotKey(sessionId), JSON.stringify(snapshots))
}

export function createSession(
  userId: string,
  title: string,
  model: string,
  systemPrompt?: string
): Session {
  const sessions = loadSessions(userId)
  const session: Session = {
    id: generateId(),
    userId,
    title,
    model,
    messages: [],
    systemPrompt,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: {},
  }
  sessions.unshift(session)
  saveSessions(userId, sessions)
  emit(Events.SESSION_CREATED, { userId, sessionId: session.id })
  return session
}

export function getSession(userId: string, sessionId: string): Session | null {
  const sessions = loadSessions(userId)
  return sessions.find(s => s.id === sessionId) || null
}

export function updateSession(userId: string, sessionId: string, updates: Partial<Session>): Session | null {
  const sessions = loadSessions(userId)
  const idx = sessions.findIndex(s => s.id === sessionId)
  if (idx < 0) return null
  const session = sessions[idx]
  const updated = { ...session, ...updates, updatedAt: new Date().toISOString() }
  sessions[idx] = updated
  saveSessions(userId, sessions)
  emit(Events.SESSION_UPDATED, { userId, sessionId })
  return updated
}

export function addMessage(
  userId: string,
  sessionId: string,
  message: Omit<SessionMessage, 'id' | 'timestamp'>
): SessionMessage | null {
  const session = getSession(userId, sessionId)
  if (!session) return null

  const msg: SessionMessage = {
    id: generateId(),
    ...message,
    timestamp: new Date().toISOString(),
  }

  session.messages.push(msg)
  session.updatedAt = new Date().toISOString()
  updateSession(userId, sessionId, { messages: session.messages })
  return msg
}

export function takeSnapshot(
  userId: string,
  sessionId: string,
  label: string
): SessionSnapshot | null {
  const session = getSession(userId, sessionId)
  if (!session) return null

  const snapshots = loadSnapshots(sessionId)
  const snapshot: SessionSnapshot = {
    id: generateId(),
    sessionId,
    messages: JSON.parse(JSON.stringify(session.messages)),
    timestamp: new Date().toISOString(),
    label,
  }
  snapshots.push(snapshot)
  saveSnapshots(sessionId, snapshots)
  return snapshot
}

export function revertToSnapshot(
  userId: string,
  sessionId: string,
  snapshotId: string
): boolean {
  const snapshots = loadSnapshots(sessionId)
  const snapshot = snapshots.find(s => s.id === snapshotId)
  if (!snapshot) return false

  const session = getSession(userId, sessionId)
  if (!session) return false

  session.messages = JSON.parse(JSON.stringify(snapshot.messages))
  session.updatedAt = new Date().toISOString()
  updateSession(userId, sessionId, { messages: session.messages })
  return true
}

export function getSnapshots(sessionId: string): SessionSnapshot[] {
  return loadSnapshots(sessionId)
}

export function listSessions(userId: string): Session[] {
  return loadSessions(userId)
}

export function deleteSession(userId: string, sessionId: string): boolean {
  const sessions = loadSessions(userId)
  const idx = sessions.findIndex(s => s.id === sessionId)
  if (idx < 0) return false
  sessions.splice(idx, 1)
  saveSessions(userId, sessions)
  localStorage.removeItem(snapshotKey(sessionId))
  return true
}

export function compactSession(
  userId: string,
  sessionId: string,
  keepLast: number = 10
): Session | null {
  const session = getSession(userId, sessionId)
  if (!session || session.messages.length <= keepLast + 2) return null

  const systemMessages = session.messages.filter(m => m.role === 'system')
  const keep = session.messages.slice(-keepLast)
  const compacted = session.messages.slice(0, -keepLast)

  const summaryText = compacted
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => `${m.role}: ${m.content.slice(0, 150)}...`)
    .join('\n')

  const summary = `[Compressed ${compacted.length} messages:]\n${summaryText}`
  const summaryMsg: SessionMessage = {
    id: generateId(),
    role: 'system',
    content: summary,
    timestamp: new Date().toISOString(),
  }

  session.messages = [...systemMessages, summaryMsg, ...keep]
  session.summary = summaryText
  session.updatedAt = new Date().toISOString()
  updateSession(userId, sessionId, { messages: session.messages, summary: session.summary })
  return session
}

export function setActiveSession(sessionId: string | null): void {
  if (typeof window === 'undefined') return
  if (sessionId) {
    localStorage.setItem(ACTIVE_KEY, sessionId)
  } else {
    localStorage.removeItem(ACTIVE_KEY)
  }
}

export function getActiveSession(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(ACTIVE_KEY)
}
