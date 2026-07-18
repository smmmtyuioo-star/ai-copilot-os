import { emit, Events } from '@/services/event-bus'

interface MemoryEntry {
  id: string
  userId: string
  type: 'observation' | 'preference' | 'fact' | 'skill' | 'interaction'
  content: string
  tags: string[]
  importance: number
  createdAt: string
  lastAccessedAt: string
  accessCount: number
}

const MEMORY_KEY_PREFIX = 'ac_memory_'

function storageKey(userId: string): string {
  return `${MEMORY_KEY_PREFIX}${userId}`
}

function load(userId: string): MemoryEntry[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(storageKey(userId)) || '[]')
  } catch { return [] }
}

function save(userId: string, entries: MemoryEntry[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(storageKey(userId), JSON.stringify(entries))
}

function generateId(): string {
  return `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}

export function addMemory(
  userId: string,
  type: MemoryEntry['type'],
  content: string,
  tags: string[] = [],
  importance: number = 1
): MemoryEntry {
  const entries = load(userId)
  const entry: MemoryEntry = {
    id: generateId(),
    userId,
    type,
    content,
    tags,
    importance: Math.max(1, Math.min(10, importance)),
    createdAt: new Date().toISOString(),
    lastAccessedAt: new Date().toISOString(),
    accessCount: 0,
  }
  entries.push(entry)
  prune(userId, entries)
  save(userId, entries)
  emit(Events.MEMORY_SAVED, { userId, type, content, tags })
  return entry
}

function prune(userId: string, entries: MemoryEntry[]): void {
  if (entries.length <= 500) return
  entries.sort((a, b) => {
    const scoreA = a.importance * (1 + Math.log1p(a.accessCount))
    const scoreB = b.importance * (1 + Math.log1p(b.accessCount))
    return scoreB - scoreA
  })
  entries.length = 500
}

export function recall(
  userId: string,
  query: string,
  maxResults: number = 10
): MemoryEntry[] {
  const entries = load(userId)
  if (!entries.length) return []

  const queryLower = query.toLowerCase()
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2)

  const scored = entries.map(entry => {
    let score = 0
    const contentLower = entry.content.toLowerCase()

    for (const term of queryTerms) {
      if (contentLower.includes(term)) score += 1
    }

    const tagMatch = entry.tags.filter(t => queryTerms.some(qt => t.toLowerCase().includes(qt))).length
    score += tagMatch * 2

    score *= (1 + Math.log1p(entry.accessCount))
    score *= (entry.importance / 10)

    return { entry, score }
  })

  scored.sort((a, b) => b.score - a.score)
  const results = scored.slice(0, maxResults)

  for (const { entry } of results) {
    entry.accessCount++
    entry.lastAccessedAt = new Date().toISOString()
  }
  save(userId, entries)
  emit(Events.MEMORY_RECALLED, { userId, query, resultCount: results.length })

  return results.filter(r => r.score > 0).map(r => r.entry)
}

export function getMemoriesByType(userId: string, type: MemoryEntry['type']): MemoryEntry[] {
  return load(userId).filter(e => e.type === type)
}

export function getImportantMemories(userId: string, minImportance: number = 7): MemoryEntry[] {
  return load(userId).filter(e => e.importance >= minImportance)
}

export function deleteMemory(userId: string, id: string): boolean {
  const entries = load(userId)
  const idx = entries.findIndex(e => e.id === id)
  if (idx < 0) return false
  entries.splice(idx, 1)
  save(userId, entries)
  return true
}

export function searchMemories(userId: string, searchText: string): MemoryEntry[] {
  const entries = load(userId)
  const lower = searchText.toLowerCase()
  return entries.filter(e =>
    e.content.toLowerCase().includes(lower) ||
    e.tags.some(t => t.toLowerCase().includes(lower))
  )
}

export function getAllMemories(userId: string): MemoryEntry[] {
  return load(userId)
}

export function getMemoryStats(userId: string): { total: number; byType: Record<string, number>; avgImportance: number } {
  const entries = load(userId)
  const byType: Record<string, number> = {}
  let totalImportance = 0
  for (const e of entries) {
    byType[e.type] = (byType[e.type] || 0) + 1
    totalImportance += e.importance
  }
  return {
    total: entries.length,
    byType,
    avgImportance: entries.length ? totalImportance / entries.length : 0,
  }
}
