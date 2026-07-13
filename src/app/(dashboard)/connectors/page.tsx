'use client'
import { useState, useEffect } from 'react'
import { Plus, Plug, Wifi, WifiOff, Trash2, CheckCircle2, AlertCircle, Loader2, ExternalLink } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Modal, Input } from '@/components/ui'
import { generateId, formatDate } from '@/lib/utils'

interface Connector {
  id: string
  name: string
  provider: string
  config: Record<string, string>
  status: 'disconnected' | 'connected' | 'error'
  lastTested?: string
  error?: string
}

const PROVIDERS = [
  { id: 'github', name: 'GitHub', desc: 'Repos, issues, PRs', docs: 'https://github.com/settings/tokens', keyLabel: 'GitHub Token', keyName: 'token' },
  { id: 'openai', name: 'OpenAI', desc: 'GPT models', docs: 'https://platform.openai.com/api-keys', keyLabel: 'API Key', keyName: 'apiKey' },
  { id: 'groq', name: 'Groq', desc: 'Fast AI inference', docs: 'https://console.groq.com/keys', keyLabel: 'API Key', keyName: 'apiKey' },
  { id: 'slack', name: 'Slack', desc: 'Messages & notifications', docs: 'https://api.slack.com/apps', keyLabel: 'Bot Token', keyName: 'token' },
]

export default function ConnectorsPage() {
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [testing, setTesting] = useState<string | null>(null)
  const [testResult, setTestResult] = useState<string | null>(null)

  useEffect(() => {
    const saved = localStorage.getItem('ac_connectors')
    if (saved) setConnectors(JSON.parse(saved))
  }, [])

  function saveConnectors(list: Connector[]) {
    setConnectors(list)
    localStorage.setItem('ac_connectors', JSON.stringify(list))
  }

  function handleAdd() {
    if (!selectedProvider || !apiKey.trim()) return
    const provider = PROVIDERS.find(p => p.id === selectedProvider)
    if (!provider) return
    const connector: Connector = {
      id: generateId(), name: provider.name, provider: provider.id,
      config: { [provider.keyName]: apiKey }, status: 'disconnected',
    }
    saveConnectors([...connectors, connector])
    setShowCreate(false); setApiKey(''); setSelectedProvider('')
  }

  async function testConnection(id: string) {
    setTesting(id)
    setTestResult(null)
    const connector = connectors.find(c => c.id === id)
    if (!connector) return

    try {
      let response
      if (connector.provider === 'github') {
        response = await fetch('https://api.github.com/user', {
          headers: { Authorization: `Bearer ${connector.config.token}`, Accept: 'application/vnd.github.v3+json' },
        })
        if (response.ok) {
          const data = await response.json()
          updateConnector(id, 'connected', `Connected as ${data.login}`)
        } else {
          updateConnector(id, 'error', `GitHub: ${response.status} ${response.statusText}`)
        }
      } else if (connector.provider === 'groq') {
        response = await fetch('https://api.groq.com/openai/v1/models', {
          headers: { Authorization: `Bearer ${connector.config.apiKey}` },
        })
        if (response.ok) {
          const data = await response.json()
          updateConnector(id, 'connected', `Groq: ${data.data?.length || 0} models available`)
        } else {
          updateConnector(id, 'error', `Groq: ${response.status} ${response.statusText}`)
        }
      } else if (connector.provider === 'openai') {
        response = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${connector.config.apiKey}` },
        })
        if (response.ok) {
          updateConnector(id, 'connected', 'OpenAI: Connected successfully')
        } else {
          updateConnector(id, 'error', `OpenAI: ${response.status} ${response.statusText}`)
        }
      } else {
        updateConnector(id, 'connected', `${connector.name}: Configured (test endpoint not available)`)
      }
    } catch (err) {
      updateConnector(id, 'error', `Connection failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
    setTesting(null)
  }

  function updateConnector(id: string, status: Connector['status'], error?: string) {
    const updated = connectors.map(c => c.id === id ? { ...c, status, error, lastTested: new Date().toISOString() } : c)
    saveConnectors(updated)
    if (status === 'connected') setTestResult('✓ ' + error)
    else setTestResult('✗ ' + error)
  }

  function deleteConnector(id: string) {
    saveConnectors(connectors.filter(c => c.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Connectors</h1>
          <p className="text-sm text-gray-500">Connect to real external services with your API keys</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Add Connector</Button>
      </div>

      {testResult && (
        <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${testResult.startsWith('✓') ? 'bg-green-50 text-green-700 dark:bg-green-900/30' : 'bg-red-50 text-red-700 dark:bg-red-900/30'}`}>
          {testResult.startsWith('✓') ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {testResult}
        </div>
      )}

      {connectors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Plug className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 text-gray-500">No connectors added. Add one with your API key to connect to real services.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {connectors.map(c => (
            <Card key={c.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle>{c.name}</CardTitle>
                  {c.status === 'connected' ? <Wifi className="h-5 w-5 text-green-500" /> :
                   c.status === 'error' ? <AlertCircle className="h-5 w-5 text-red-500" /> :
                   <WifiOff className="h-5 w-5 text-gray-400" />}
                </div>
                <CardDescription>{c.provider}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {c.error && <p className="text-xs text-red-500">{c.error}</p>}
                {c.lastTested && <p className="text-xs text-gray-400">Last tested: {formatDate(c.lastTested)}</p>}
                <div className="flex gap-2">
                  <Button size="sm" variant="secondary" onClick={() => testConnection(c.id)} loading={testing === c.id}>
                    <Wifi className="h-4 w-4" /> Test
                  </Button>
                  <Button size="sm" variant="danger" onClick={() => deleteConnector(c.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Real Connector">
        <div className="space-y-4">
          <div className="space-y-2">
            {PROVIDERS.map(p => (
              <button key={p.id} onClick={() => setSelectedProvider(p.id)}
                className={`w-full rounded-lg border p-3 text-left text-sm ${
                  selectedProvider === p.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600'
                }`}>
                <p className="font-medium">{p.name}</p>
                <p className="text-xs text-gray-500">{p.desc}</p>
              </button>
            ))}
          </div>
          {selectedProvider && (
            <>
              <Input id="api-key" label={PROVIDERS.find(p => p.id === selectedProvider)?.keyLabel || 'API Key'}
                type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..." />
              <p className="text-xs text-gray-400">
                Get your key from <a href={PROVIDERS.find(p => p.id === selectedProvider)?.docs} target="_blank" className="text-blue-500 underline">here</a>
              </p>
            </>
          )}
          <Button onClick={handleAdd} className="w-full" disabled={!selectedProvider || !apiKey.trim()}>
            Add & Test Connector
          </Button>
        </div>
      </Modal>
    </div>
  )
}
