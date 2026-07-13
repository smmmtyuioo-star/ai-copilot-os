'use client'
import { useState, useEffect } from 'react'
import { Plus, Plug, Trash2, Wifi, WifiOff } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Modal } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { getSupabase } from '@/database/client'
import type { Connector } from '@/types'
import { formatDate, generateId } from '@/lib/utils'

const CONNECTOR_PROVIDERS = [
  { id: 'github', name: 'GitHub', desc: 'Repositories, issues, PRs' },
  { id: 'slack', name: 'Slack', desc: 'Messages, channels, notifications' },
  { id: 'gmail', name: 'Gmail', desc: 'Emails, labels, search' },
  { id: 'google-drive', name: 'Google Drive', desc: 'Files, folders, sharing' },
  { id: 'notion', name: 'Notion', desc: 'Pages, databases, search' },
  { id: 'linear', name: 'Linear', desc: 'Issues, projects, cycles' },
]

export default function ConnectorsPage() {
  const { user } = useAuth()
  const [connectors, setConnectors] = useState<Connector[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState('')

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    if (!user) return
    const supabase = getSupabase()
    if (!supabase) return
    const { data } = await supabase.from('connectors').select('*').eq('user_id', user.id)
    setConnectors(data || [])
  }

  async function handleCreate() {
    if (!user || !selectedProvider) return
    const provider = CONNECTOR_PROVIDERS.find(p => p.id === selectedProvider)
    if (!provider) return

    const connector: Connector = {
      id: generateId(),
      user_id: user.id,
      name: provider.name,
      provider: provider.id,
      config: {},
      status: 'disconnected',
      created_at: new Date().toISOString(),
    }
    const supabase = getSupabase()
    if (!supabase) return
    const { error } = await supabase.from('connectors').insert(connector)
    if (!error) {
      setConnectors(prev => [...prev, connector])
      setShowCreate(false)
      setSelectedProvider('')
    }
  }

  async function handleDelete(id: string) {
    const supabase = getSupabase()
    if (supabase) await supabase.from('connectors').delete().eq('id', id)
    setConnectors(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Connectors</h1>
          <p className="text-sm text-gray-500">Connect to external services</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Add Connector</Button>
      </div>

      {connectors.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Plug className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 text-gray-500">No connectors yet. Connect to external services.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {connectors.map(connector => (
            <Card key={connector.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle>{connector.name}</CardTitle>
                  {connector.status === 'connected'
                    ? <Wifi className="h-5 w-5 text-green-500" />
                    : <WifiOff className="h-5 w-5 text-gray-400" />}
                </div>
                <CardDescription>Provider: {connector.provider}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-xs text-gray-500">Added {formatDate(connector.created_at)}</p>
                <Button size="sm" variant="danger" onClick={() => handleDelete(connector.id)}>
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Connector">
        <div className="space-y-4">
          <div className="grid gap-3">
            {CONNECTOR_PROVIDERS.map(p => (
              <button
                key={p.id}
                onClick={() => setSelectedProvider(p.id)}
                className={`flex items-center gap-3 rounded-lg border p-3 text-left text-sm transition-colors ${
                  selectedProvider === p.id
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30'
                    : 'border-gray-200 hover:bg-gray-50 dark:border-gray-600'
                }`}
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{p.name}</p>
                  <p className="text-xs text-gray-500">{p.desc}</p>
                </div>
              </button>
            ))}
          </div>
          <Button onClick={handleCreate} className="w-full" disabled={!selectedProvider}>Add</Button>
        </div>
      </Modal>
    </div>
  )
}
