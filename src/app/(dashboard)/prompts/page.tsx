'use client'
import { useState, useEffect, useCallback } from 'react'
import { Brain, Search, Trash2, ChevronDown, ChevronRight, Copy, CheckCircle2, XCircle, Clock, ExternalLink, RefreshCw, Loader2, AlertCircle, FileText } from 'lucide-react'

interface PromptRecord {
  id: string
  timestamp: string
  source: string
  model: string
  provider: string
  systemPrompt: string
  messages: { role: string; content: string }[]
  tools?: string[]
  mcpEndpoints?: any[]
  temperature?: number
  maxTokens?: number
  durationMs: number
  success: boolean
  error?: string
  responseContent: string
  tokenCount?: number
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatDate(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString() + ' ' + d.toLocaleDateString()
}

function JsonBlock({ data, label }: { data: any; label: string }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  const preview = text.slice(0, 200)

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* noop */ }
  }

  return (
    <div className="rounded-lg border border-gray-200 dark:border-gray-700">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium text-gray-600 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800/50">
        <span>{open ? <ChevronDown className="inline h-3 w-3" /> : <ChevronRight className="inline h-3 w-3" />} {label} <span className="text-gray-400 font-normal">({text.length} chars)</span></span>
        <button onClick={(e) => { e.stopPropagation(); copy() }} className="rounded p-1 hover:bg-gray-200 dark:hover:bg-gray-700">
          {copied ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
        </button>
      </button>
      {open && (
        <pre className="max-h-96 overflow-auto border-t border-gray-200 p-3 text-xs font-mono leading-relaxed dark:border-gray-700 dark:bg-gray-950/50 whitespace-pre-wrap break-all">{text}</pre>
      )}
      {!open && (
        <div className="border-t border-gray-200 px-3 py-2 text-[10px] text-gray-400 font-mono dark:border-gray-700 truncate">{preview}{text.length > 200 ? '...' : ''}</div>
      )}
    </div>
  )
}

export default function PromptsPage() {
  const [records, setRecords] = useState<PromptRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [sourceFilter, setSourceFilter] = useState('all')

  const fetchRecords = useCallback(async () => {
    try {
      const res = await fetch('/api/prompts', { signal: AbortSignal.timeout(5000) })
      if (res.ok) {
        const data = await res.json()
        if (data.success && data.data) setRecords(data.data)
      }
    } catch { /* silent */ } finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchRecords(); const iv = setInterval(fetchRecords, 3000); return () => clearInterval(iv) }, [fetchRecords])

  async function clearAll() {
    try {
      await fetch('/api/prompts', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'all' }) })
      setRecords([])
    } catch { /* noop */ }
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  const sources = ['all', ...new Set(records.map(r => r.source))]
  const filtered = records.filter(r => {
    if (sourceFilter !== 'all' && r.source !== sourceFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return r.model.toLowerCase().includes(q) || r.responseContent.toLowerCase().includes(q) ||
        r.messages.some(m => m.content.toLowerCase().includes(q)) || (r.systemPrompt || '').toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/30">
              <Brain className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Prompt Inspector</h1>
              <p className="text-xs text-gray-500 dark:text-gray-400">Live capture of every AI prompt sent — system prompt, messages, tools, and response</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchRecords} className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-800">
            <RefreshCw className="h-3 w-3" /> Refresh
          </button>
          <button onClick={clearAll} className="flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30">
            <Trash2 className="h-3 w-3" /> Clear All
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-4 flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by model, content, system prompt..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-xs dark:border-gray-700 dark:bg-gray-800"
          />
        </div>
        <div className="flex gap-1">
          {sources.map(s => (
            <button key={s} onClick={() => setSourceFilter(s)}
              className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium ${sourceFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700'}`}>
              {s === 'all' ? 'All' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Stats bar */}
      {records.length > 0 && (
        <div className="mb-4 flex gap-4 text-xs text-gray-500 dark:text-gray-400">
          <span>{records.length} total</span>
          <span>{records.filter(r => r.success).length} successful</span>
          <span>{records.filter(r => !r.success).length} failed</span>
          <span>Avg: {formatDuration(records.reduce((s, r) => s + r.durationMs, 0) / records.length)}</span>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Brain className="h-12 w-12 text-gray-300 dark:text-gray-600" />
          <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            {records.length === 0 ? 'No prompts captured yet. Send a message in chat to see it here.' : 'No prompts match your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(record => {
            const isOpen = expanded.has(record.id)
            return (
              <div key={record.id} className="rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                {/* Summary row */}
                <button onClick={() => toggleExpand(record.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <div className="shrink-0">{record.success ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-medium truncate">{record.model}</span>
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-800">{record.source}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] ${record.provider !== 'unknown' ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-gray-100 text-gray-400 dark:bg-gray-800'}`}>{record.provider === 'unknown' ? '' : record.provider}</span>
                    </div>
                    <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400 truncate">
                      {record.messages.filter(m => m.role === 'user').pop()?.content?.slice(0, 120) || '(no user message)'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-[10px] text-gray-400">{formatDate(record.timestamp)}</p>
                    <p className="text-[10px] text-gray-400">{formatDuration(record.durationMs)}</p>
                  </div>
                  <div className="shrink-0">{isOpen ? <ChevronDown className="h-4 w-4 text-gray-400" /> : <ChevronRight className="h-4 w-4 text-gray-400" />}</div>
                </button>

                {/* Expanded detail */}
                {isOpen && (
                  <div className="border-t border-gray-200 px-4 py-3 space-y-3 dark:border-gray-700">
                    {/* System Prompt */}
                    <div>
                      <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">System Prompt</p>
                      <JsonBlock data={record.systemPrompt || '(none)'} label="system_prompt" />
                    </div>

                    {/* Messages */}
                    <div>
                      <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">Messages ({record.messages.length})</p>
                      {record.messages.map((msg, i) => (
                        <div key={i} className="mb-1.5">
                          <JsonBlock data={msg.content} label={`[${i}] role: ${msg.role}`} />
                        </div>
                      ))}
                    </div>

                    {/* Tools */}
                    {record.tools && record.tools.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">Tools ({record.tools.length})</p>
                        <JsonBlock data={record.tools} label="tools" />
                      </div>
                    )}

                    {/* MCP Endpoints */}
                    {record.mcpEndpoints && record.mcpEndpoints.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">MCP Endpoints ({record.mcpEndpoints.length})</p>
                        <JsonBlock data={record.mcpEndpoints} label="mcp_endpoints" />
                      </div>
                    )}

                    {/* Response */}
                    <div>
                      <p className="mb-1 text-xs font-semibold text-gray-500 dark:text-gray-400">Response</p>
                      {record.error ? (
                        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-600 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400">
                          Error: {record.error}
                        </div>
                      ) : record.responseContent ? (
                        <JsonBlock data={record.responseContent} label="response" />
                      ) : (
                        <p className="text-xs text-gray-400 italic">No response content captured</p>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap gap-2 text-[10px] text-gray-400">
                      <span>ID: {record.id}</span>
                      <span>·</span>
                      <span>Temperature: {record.temperature ?? 'default'}</span>
                      <span>·</span>
                      <span>Max tokens: {record.maxTokens ?? 'default'}</span>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
