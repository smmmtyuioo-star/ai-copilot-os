'use client'
import { useState, useEffect, useRef } from 'react'
import { Plus, Network, Trash2, Wifi, WifiOff, CheckCircle2, AlertCircle, Play, Zap, Server, Database, Globe, Bot, Code, Brain, Search } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Modal } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { localStore, hasSupabase } from '@/lib/storage'
import { getSupabase } from '@/database/client'
import type { MCPEndpoint } from '@/types'
import { formatDate, generateId } from '@/lib/utils'

const CATEGORY_EMOJI: Record<string, string> = {
  'AI Models': '🤖',
  'Developer Tools': '🛠️',
  'Database & Backend': '🗄️',
  'Communication': '💬',
  'Productivity': '📋',
}

interface RegistryEntry {
  name: string; url: string; protocol: string; desc: string; category: string
}

const MCP_REGISTRY: RegistryEntry[] = [
  { name: 'OpenAI API', url: 'api.openai.com/v1', protocol: 'https', desc: 'GPT-4, GPT-4o, DALL-E, Whisper', category: 'AI Models' },
  { name: 'Anthropic API', url: 'api.anthropic.com/v1', protocol: 'https', desc: 'Claude models API', category: 'AI Models' },
  { name: 'Groq API', url: 'api.groq.com/openai/v1', protocol: 'https', desc: 'Fast Llama, Mixtral, Gemma', category: 'AI Models' },
  { name: 'Mistral AI', url: 'api.mistral.ai/v1', protocol: 'https', desc: 'Mistral models', category: 'AI Models' },
  { name: 'DeepSeek API', url: 'api.deepseek.com', protocol: 'https', desc: 'DeepSeek models', category: 'AI Models' },
  { name: 'GitHub API', url: 'api.github.com', protocol: 'https', desc: 'Repos, issues, PRs, actions, releases', category: 'Developer Tools' },
  { name: 'GitLab API', url: 'gitlab.com/api/v4', protocol: 'https', desc: 'Repos, CI/CD, issues, merge requests', category: 'Developer Tools' },
  { name: 'Vercel API', url: 'api.vercel.com', protocol: 'https', desc: 'Deployments, domains, env variables', category: 'Developer Tools' },
  { name: 'Netlify API', url: 'api.netlify.com/v1', protocol: 'https', desc: 'Sites, deploys, forms, functions', category: 'Developer Tools' },
  { name: 'Supabase API', url: 'supabase.co', protocol: 'https', desc: 'Database, auth, storage, realtime', category: 'Database & Backend' },
  { name: 'Firebase API', url: 'firebase.googleapis.com/v1', protocol: 'https', desc: 'Firestore, auth, storage, functions', category: 'Database & Backend' },
  { name: 'Pinecone API', url: 'api.pinecone.io', protocol: 'https', desc: 'Vector database for embeddings & search', category: 'Database & Backend' },
  { name: 'Hugging Face', url: 'huggingface.co/api', protocol: 'https', desc: 'Models, datasets, spaces, inference', category: 'AI Models' },
  { name: 'Replicate API', url: 'api.replicate.com/v1', protocol: 'https', desc: 'Run open-source models in the cloud', category: 'AI Models' },
  { name: 'Slack API', url: 'slack.com/api', protocol: 'https', desc: 'Messaging, channels, files, workflows', category: 'Communication' },
  { name: 'Discord API', url: 'discord.com/api/v10', protocol: 'https', desc: 'Channels, messages, guilds, webhooks', category: 'Communication' },
  { name: 'Jira API', url: 'your-domain.atlassian.net/rest/api/3', protocol: 'https', desc: 'Issues, projects, sprints, boards', category: 'Developer Tools' },
  { name: 'Notion API', url: 'api.notion.com/v1', protocol: 'https', desc: 'Pages, databases, blocks, search', category: 'Productivity' },
  { name: 'Google APIs', url: 'googleapis.com', protocol: 'https', desc: 'Drive, Sheets, Gmail, Calendar, Cloud', category: 'Productivity' },
  { name: 'Cloudflare API', url: 'api.cloudflare.com/client/v4', protocol: 'https', desc: 'DNS, Workers, R2, D1, AI Gateway', category: 'Developer Tools' },
]

const PRESETS = [
  { name: 'OpenAI API', url: 'api.openai.com/v1', protocol: 'https', icon: Brain, desc: 'GPT-4, GPT-4o models' },
  { name: 'Groq API', url: 'api.groq.com/openai/v1', protocol: 'https', icon: Zap, desc: 'Fast Llama, Mixtral inference' },
  { name: 'GitHub API', url: 'api.github.com', protocol: 'https', icon: Code, desc: 'Repos, issues, PRs, actions' },
  { name: 'Supabase API', url: 'supabase.co', protocol: 'https', icon: Database, desc: 'Database, auth, storage' },
  { name: 'Hugging Face', url: 'huggingface.co/api', protocol: 'https', icon: Bot, desc: 'Models, datasets, spaces' },
  { name: 'Vercel API', url: 'api.vercel.com', protocol: 'https', icon: Globe, desc: 'Deployments, domains, env' },
  { name: 'Local Server', url: 'localhost:3000', protocol: 'http', icon: Server, desc: 'Local development server' },
  { name: 'Custom', url: '', protocol: 'https', icon: Globe, desc: 'Any HTTP/HTTPS endpoint' },
]

function getAuthHeadersForUrl(url: string): Record<string, string> {
  const providerMap: Record<string, string> = {
    'openai.com': 'openai',
    'anthropic.com': 'anthropic',
    'groq.com': 'groq',
    'mistral.ai': 'mistral',
    'deepseek.com': 'deepseek',
    'github.com': 'github',
    'gitlab.com': 'gitlab',
    'vercel.com': 'vercel',
    'netlify.com': 'netlify',
    'supabase.co': 'supabase',
    'firebase.googleapis.com': 'firebase',
    'pinecone.io': 'pinecone',
    'huggingface.co': 'huggingface',
    'replicate.com': 'replicate',
    'slack.com': 'slack',
    'discord.com': 'discord',
    'notion.com': 'notion',
    'googleapis.com': 'google',
    'cloudflare.com': 'cloudflare',
  }
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  try {
    const raw = localStorage.getItem('ac_apikeys')
    if (!raw) return headers
    const keys = JSON.parse(raw)
    if (!Array.isArray(keys)) return headers
    for (const [domain, provider] of Object.entries(providerMap)) {
      if (url.includes(domain)) {
        const match = keys.find((k: any) =>
          k.provider?.toLowerCase() === provider ||
          k.name?.toLowerCase().includes(provider)
        )
        if (match?.key) headers['Authorization'] = `Bearer ${match.key}`
        break
      }
    }
  } catch { /* ignore */ }
  return headers
}

function addConnectorDirectly(userId: string, entry: RegistryEntry, setEndpoints: any, setMessage: any) {
  const endpoint: MCPEndpoint = {
    id: generateId(), user_id: userId, name: entry.name, url: entry.url,
    protocol: entry.protocol, status: 'inactive', created_at: new Date().toISOString(),
  }
  localStore.mcpEndpoints.add({ id: endpoint.id, name: entry.name, url: entry.url, protocol: entry.protocol, status: 'inactive', createdAt: endpoint.created_at })
  setEndpoints((prev: MCPEndpoint[]) => [...prev, endpoint])
  setMessage({ ok: true, text: `"${entry.name}" added. Test the connection below.` })
  setTimeout(() => setMessage(null), 3000)
}

export default function MCPPage() {
  const { user } = useAuth()
  const [endpoints, setEndpoints] = useState<MCPEndpoint[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [protocol, setProtocol] = useState('https')
  const [testing, setTesting] = useState<string | null>(null)
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({})
  const [selectedPreset, setSelectedPreset] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null)
  const [paused, setPaused] = useState(false)
  const pausedRef = useRef(false)
  const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => { if (user) { load(); startHealthMonitor() }; return () => stopHealthMonitor() }, [user])

  async function startHealthMonitor() {
    monitorRef.current = setInterval(async () => {
      if (pausedRef.current) return
      for (const ep of endpoints) {
        const startTime = Date.now()
        try {
          const fullUrl = `${ep.protocol}://${ep.url}`
          const controller = new AbortController()
          const timeout = setTimeout(() => controller.abort(), 5000)
          const response = await fetch('/api/browser/fetch', {
            method: 'POST',
            headers: getAuthHeadersForUrl(fullUrl),
            body: JSON.stringify({ url: fullUrl }),
            signal: controller.signal,
          })
          clearTimeout(timeout)
          const ms = Date.now() - startTime
          setTestResults(prev => ({ ...prev, [ep.id]: { ok: response.ok, message: response.ok ? `Connected in ${ms}ms` : `HTTP ${response.status} (${ms}ms)` } }))
          if (ep.status !== 'active') updateEndpointStatus(ep.id, 'active')
        } catch {
          const ms = Date.now() - startTime
          setTestResults(prev => ({ ...prev, [ep.id]: { ok: false, message: `Unreachable (${ms}ms)` } }))
          if (ep.status !== 'inactive') updateEndpointStatus(ep.id, 'inactive')
        }
      }
    }, 30000)
  }

  function stopHealthMonitor() {
    if (monitorRef.current) { clearInterval(monitorRef.current); monitorRef.current = null }
  }

  async function updateEndpointStatus(id: string, status: MCPEndpoint['status']) {
    setEndpoints(prev => prev.map(e => e.id === id ? { ...e, status } : e))
  }

  async function load() {
    if (!user) return
    if (hasSupabase) {
      const supabase = getSupabase()
      if (supabase) {
        const { data } = await supabase.from('mcp_endpoints').select('*').eq('user_id', user.id)
        if (data) { setEndpoints(data); return }
      }
    }
    setEndpoints(localStore.mcpEndpoints.items.map(e => ({
      id: e.id, user_id: user.id, name: e.name, url: e.url,
      protocol: e.protocol, status: e.status as MCPEndpoint['status'], created_at: e.createdAt,
    })))
  }

  const existingUrls = new Set(endpoints.map(e => e.url))

  const searchResults = searchQuery.length < 2 ? [] : MCP_REGISTRY.filter(r =>
    r.name.toLowerCase().includes(searchQuery) ||
    r.desc.toLowerCase().includes(searchQuery) ||
    r.category.toLowerCase().includes(searchQuery)
  ).slice(0, 8)

  const registryByCategory: Record<string, RegistryEntry[]> = {}
  MCP_REGISTRY.forEach(r => {
    if (!registryByCategory[r.category]) registryByCategory[r.category] = []
    registryByCategory[r.category].push(r)
  })

  function selectPreset(presetName: string) {
    const preset = PRESETS.find(p => p.name === presetName)
    if (!preset) return
    setSelectedPreset(presetName)
    setName(preset.name)
    setUrl(preset.url)
    setProtocol(preset.protocol)
  }

  async function handleCreate() {
    if (!user || !name.trim() || !url.trim()) return
    const endpoint: MCPEndpoint = {
      id: generateId(), user_id: user.id, name, url, protocol,
      status: 'inactive', created_at: new Date().toISOString(),
    }
    if (hasSupabase) {
      const supabase = getSupabase()
      if (supabase) {
        const { error } = await supabase.from('mcp_endpoints').insert(endpoint)
        if (!error) { setEndpoints(prev => [...prev, endpoint]); setShowCreate(false); setName(''); setUrl(''); setSelectedPreset(''); return }
      }
    }
    localStore.mcpEndpoints.add({ id: endpoint.id, name, url, protocol, status: 'inactive', createdAt: endpoint.created_at })
    setEndpoints(prev => [...prev, endpoint])
    setShowCreate(false); setName(''); setUrl(''); setSelectedPreset('')
  }

  async function handleDelete(id: string) {
    if (hasSupabase) { const supabase = getSupabase(); if (supabase) await supabase.from('mcp_endpoints').delete().eq('id', id) }
    localStore.mcpEndpoints.remove(id)
    setEndpoints(prev => prev.filter(e => e.id !== id))
    delete testResults[id]
  }

  async function testConnection(id: string) {
    setTesting(id)
    const ep = endpoints.find(e => e.id === id)
    if (!ep) return
    const startTime = Date.now()
    try {
      const fullUrl = `${ep.protocol}://${ep.url}`
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 8000)
      const response = await fetch('/api/browser/fetch', {
        method: 'POST',
        headers: getAuthHeadersForUrl(fullUrl),
        body: JSON.stringify({ url: fullUrl }),
        signal: controller.signal,
      })
      clearTimeout(timeout)
      const ms = Date.now() - startTime
      if (response.ok) {
        setTestResults(prev => ({ ...prev, [id]: { ok: true, message: `Connected in ${ms}ms` } }))
      } else {
        const data = await response.json()
        setTestResults(prev => ({ ...prev, [id]: { ok: false, message: `HTTP ${response.status}: ${data.error || response.statusText} (${ms}ms)` } }))
      }
    } catch (err) {
      const ms = Date.now() - startTime
      setTestResults(prev => ({ ...prev, [id]: { ok: false, message: `Failed in ${ms}ms: ${err instanceof Error ? err.message : 'Unknown error'}` } }))
    }
    setTesting(null)
  }

  async function testAllConnections() {
    for (const ep of endpoints) { await testConnection(ep.id) }
  }

  function togglePause() {
    setPaused(prev => { pausedRef.current = !prev; return !prev })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">MCP Endpoints</h1>
          <p className="text-sm text-gray-500">Model Context Protocol — discover and connect to APIs</p>
        </div>
        <div className="flex gap-2">
          {endpoints.length > 1 && (
            <Button variant="secondary" onClick={testAllConnections} size="sm" loading={testing !== null}>
              <Zap className="h-4 w-4" /> Test All
            </Button>
          )}
          {endpoints.length > 0 && (
            <Button variant="secondary" onClick={togglePause} size="sm">
              {paused ? 'Resume Monitoring' : 'Pause Monitoring'}
            </Button>
          )}
          <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Add Endpoint</Button>
        </div>
      </div>

      {message && (
        <div className={`flex items-center gap-2 rounded-lg px-4 py-3 text-sm ${message.ok ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-300' : 'bg-red-50 text-red-700'}`}>
          {message.ok ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Discover Connectors</CardTitle>
          <CardDescription>Search the registry of 20+ API connectors — one-click add</CardDescription>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value.toLowerCase())}
              placeholder="Search by name, category, or description..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm dark:border-gray-600 dark:bg-gray-700"
            />
          </div>
        </CardHeader>
        {searchQuery.length >= 2 ? (
          <CardContent>
            {searchResults.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No connectors match &quot;{searchQuery}&quot;</p>
            ) : (
              <div className="space-y-2">
                {searchResults.map(r => {
                  const alreadyAdded = existingUrls.has(r.url)
                  return (
                    <div key={r.name} className="flex items-center justify-between rounded-lg border border-gray-100 dark:border-gray-700 p-3 hover:bg-gray-50 dark:hover:bg-gray-800">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="text-lg shrink-0">{CATEGORY_EMOJI[r.category] || '🔌'}</span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{r.name}</span>
                            <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{r.category}</span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">{r.desc}</p>
                          <code className="text-xs text-gray-400 font-mono">{r.protocol}://{r.url}</code>
                        </div>
                      </div>
                      {alreadyAdded ? (
                        <span className="shrink-0 text-xs text-green-600 font-medium ml-2">Added</span>
                      ) : (
                        <button onClick={() => user && addConnectorDirectly(user.id, r, setEndpoints, setMessage)}
                          className="shrink-0 text-xs text-blue-600 hover:text-blue-800 font-medium ml-2 hover:underline">+ Add</button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </CardContent>
        ) : (
          <CardContent>
            <div className="space-y-4">
              {Object.entries(registryByCategory).map(([category, items]) => (
                <div key={category}>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{CATEGORY_EMOJI[category] || '🔌'} {category} ({items.length})</h4>
                  <div className="flex flex-wrap gap-2">
                    {items.map(r => {
                      const alreadyAdded = existingUrls.has(r.url)
                      return (
                        <button key={r.name}
                          onClick={() => {
                            if (!alreadyAdded && user) addConnectorDirectly(user.id, r, setEndpoints, setMessage)
                          }}
                          disabled={alreadyAdded}
                          className={`text-xs rounded-lg border px-3 py-1.5 transition-colors ${alreadyAdded ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300 cursor-default' : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 text-gray-700 dark:text-gray-300'}`}>
                          {alreadyAdded ? '✓ ' : '+ '}{r.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {endpoints.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Network className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 text-gray-500">No MCP endpoints configured yet.</p>
            <p className="text-xs text-gray-400 mt-1">Search above or click &quot;Add Endpoint&quot; to connect your first API.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {endpoints.map(ep => (
            <Card key={ep.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-sm">{ep.name}</CardTitle>
                  {ep.status === 'active' ? <Wifi className="h-5 w-5 text-green-500" /> : <WifiOff className="h-5 w-5 text-gray-400" />}
                </div>
                <CardDescription className="text-xs font-mono">{ep.protocol}://{ep.url}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-2 text-xs text-gray-500">Added {formatDate(ep.created_at)}</p>
                {testResults[ep.id] && (
                  <div className={`mb-2 flex items-center gap-1 text-xs ${testResults[ep.id].ok ? 'text-green-600' : 'text-red-600'}`}>
                    {testResults[ep.id].ok ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                    {testResults[ep.id].message}
                  </div>
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => testConnection(ep.id)} loading={testing === ep.id}>
                    <Play className="h-4 w-4" /> Test
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(ep.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add MCP Endpoint">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Quick-add from presets</label>
            <div className="grid grid-cols-2 gap-2">
              {PRESETS.map(p => {
                const Icon = p.icon
                return (
                  <button key={p.name} onClick={() => selectPreset(p.name)}
                    className={`rounded-lg border p-2 text-left text-xs transition-colors ${selectedPreset === p.name ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800'}`}>
                    <div className="flex items-center gap-1.5 font-medium">
                      <Icon className="h-3.5 w-3.5 text-blue-600" />
                      {p.name}
                    </div>
                    <p className="text-gray-400 mt-0.5">{p.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>
          <div className="border-t border-gray-200 pt-4 dark:border-gray-700">
            <p className="text-xs text-gray-500 mb-3">Or enter custom endpoint details:</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                <input value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" placeholder="My MCP Server" />
              </div>
              <div className="flex gap-2">
                <div className="w-24">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Protocol</label>
                  <select value={protocol} onChange={e => setProtocol(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700">
                    <option value="https">HTTPS</option>
                    <option value="http">HTTP</option>
                    <option value="grpc">gRPC</option>
                    <option value="ws">WebSocket</option>
                    <option value="wss">WSS</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">URL</label>
                  <input value={url} onChange={e => setUrl(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" placeholder="api.example.com/v1" />
                </div>
              </div>
            </div>
          </div>
          <Button onClick={handleCreate} className="w-full" disabled={!name.trim() || !url.trim()}>Add Endpoint</Button>
        </div>
      </Modal>
    </div>
  )
}
