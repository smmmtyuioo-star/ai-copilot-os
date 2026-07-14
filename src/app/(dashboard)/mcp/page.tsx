'use client'
import { useState, useEffect } from 'react'
import { Plus, Network, Trash2, Wifi, WifiOff, Loader2, CheckCircle2, AlertCircle, Play, Zap, Server, Database, Globe, Bot, Code, Brain } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Modal } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { localStore, hasSupabase } from '@/lib/storage'
import { getSupabase } from '@/database/client'
import type { MCPEndpoint } from '@/types'
import { formatDate, generateId } from '@/lib/utils'

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

  useEffect(() => { if (user) load() }, [user])

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
        headers: { 'Content-Type': 'application/json' },
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
    for (const ep of endpoints) {
      await testConnection(ep.id)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">MCP Endpoints</h1>
          <p className="text-sm text-gray-500">Model Context Protocol integration — connect to AI APIs</p>
        </div>
        <div className="flex gap-2">
          {endpoints.length > 1 && (
            <Button variant="secondary" onClick={testAllConnections} size="sm" loading={testing !== null}>
              <Zap className="h-4 w-4" /> Test All
            </Button>
          )}
          <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Add Endpoint</Button>
        </div>
      </div>

      {endpoints.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Network className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 text-gray-500">No MCP endpoints configured.</p>
            <p className="text-xs text-gray-400 mt-1">Add endpoints to connect AI models, databases, and APIs.</p>
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
                <CardDescription className="text-xs">{ep.protocol}://{ep.url}</CardDescription>
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
