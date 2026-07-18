'use client'

export interface PromptRecord {
  id: string
  timestamp: string
  source: 'chat' | 'agent-loop' | 'build-pipeline' | 'game-builder' | 'website-builder' | 'plugin' | 'skill'
  model: string
  provider: string
  systemPrompt: string
  messages: { role: string; content: string }[]
  tools?: any[]
  mcpEndpoints?: any[]
  temperature?: number
  maxTokens?: number
  responseContent: string
  responseFull?: any
  durationMs: number
  success: boolean
  error?: string
  tokenCount?: number
}

const MAX_RECORDS = 200
const STORAGE_KEY = 'ac_prompt_records'

let records: PromptRecord[] = []
let listeners: Array<() => void> = []

function loadFromStorage() {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) records = JSON.parse(raw)
  } catch { /* noop */ }
}

function persist() {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(0, MAX_RECORDS)))
  } catch { /* noop */ }
}

loadFromStorage()

export const promptInspector = {
  getRecords(): PromptRecord[] {
    return [...records]
  },

  getRecord(id: string): PromptRecord | undefined {
    return records.find(r => r.id === id)
  },

  clearRecords() {
    records = []
    persist()
    listeners.forEach(l => l())
  },

  deleteRecord(id: string) {
    records = records.filter(r => r.id !== id)
    persist()
    listeners.forEach(l => l())
  },

  subscribe(listener: () => void) {
    listeners.push(listener)
    return () => {
      listeners = listeners.filter(l => l !== listener)
    }
  },

  addRecord(record: Omit<PromptRecord, 'id' | 'timestamp'>) {
    const id = `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
    const entry = { id, timestamp: new Date().toISOString(), ...record }
    records.unshift(entry)
    if (records.length > MAX_RECORDS) records = records.slice(0, MAX_RECORDS)
    persist()
    listeners.forEach(l => l())
    return id
  },

  updateRecord(id: string, updates: Partial<PromptRecord>) {
    const idx = records.findIndex(r => r.id === id)
    if (idx >= 0) {
      records[idx] = { ...records[idx], ...updates }
      persist()
      listeners.forEach(l => l())
    }
  },
}
