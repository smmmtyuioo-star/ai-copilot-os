export interface ToolCallRecord {
  timestamp: string
  tool: string
  userId: string
  sessionId?: string
  args: Record<string, any>
  latencyMs: number
  success: boolean
  resultLength: number
  error?: string
  usedInFinalAnswer?: boolean
}

export interface TelemetryStore {
  toolCalls: ToolCallRecord[]
  sessionStart: string
}

const inMemoryStore: Map<string, ToolCallRecord[]> = new Map()

const STORAGE_KEY = 'ac_telemetry'

function persistToStorage(): void {
  if (typeof window === 'undefined') return
  try {
    const all: ToolCallRecord[] = []
    for (const calls of inMemoryStore.values()) {
      all.push(...calls)
    }
    const recent = all.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 500)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recent))
  } catch {}
}

function loadFromStorage(): void {
  if (typeof window === 'undefined') return
  try {
    const data = localStorage.getItem(STORAGE_KEY)
    if (data) {
      const records: ToolCallRecord[] = JSON.parse(data)
      inMemoryStore.set('persisted', records)
    }
  } catch {}
}

loadFromStorage()

export function recordToolCall(record: ToolCallRecord): void {
  const sessionKey = record.sessionId || 'default'
  const calls = inMemoryStore.get(sessionKey) || []
  calls.push(record)
  inMemoryStore.set(sessionKey, calls)
  persistToStorage()

  if (typeof console !== 'undefined') {
    const status = record.success ? 'OK' : 'FAIL'
    const duration = record.latencyMs > 1000 ? `${(record.latencyMs / 1000).toFixed(1)}s` : `${record.latencyMs}ms`
    console.log(`[TOOL] ${record.tool} | ${status} | ${duration} | ${record.resultLength} chars | user=${record.userId.slice(0, 8)}`)
    if (record.error) console.log(`[TOOL-ERR] ${record.tool}: ${record.error}`)
  }
}

export function getSessionLogs(sessionId: string): ToolCallRecord[] {
  return inMemoryStore.get(sessionId) || []
}

export function getAllLogs(): ToolCallRecord[] {
  const all: ToolCallRecord[] = []
  for (const calls of inMemoryStore.values()) {
    all.push(...calls)
  }
  return all.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
}

export function getToolStats(sessionId?: string): { total: number; success: number; failed: number; avgLatency: number; byTool: Record<string, { calls: number; success: number; avgLatency: number }> } {
  const calls = sessionId ? getSessionLogs(sessionId) : getAllLogs()
  const byTool: Record<string, { calls: number; success: number; avgLatency: number }> = {}
  let totalLatency = 0

  for (const c of calls) {
    if (!byTool[c.tool]) byTool[c.tool] = { calls: 0, success: 0, avgLatency: 0 }
    byTool[c.tool].calls++
    if (c.success) byTool[c.tool].success++
    byTool[c.tool].avgLatency = (byTool[c.tool].avgLatency * (byTool[c.tool].calls - 1) + c.latencyMs) / byTool[c.tool].calls
    totalLatency += c.latencyMs
  }

  return {
    total: calls.length,
    success: calls.filter(c => c.success).length,
    failed: calls.filter(c => !c.success).length,
    avgLatency: calls.length > 0 ? totalLatency / calls.length : 0,
    byTool,
  }
}

export function clearLogs(sessionId?: string): void {
  if (sessionId) {
    inMemoryStore.delete(sessionId)
  } else {
    inMemoryStore.clear()
  }
}
