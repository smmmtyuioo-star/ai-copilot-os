'use client'
import { useState, useEffect } from 'react'
import { Plus, Network, Trash2, Wifi, WifiOff } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Modal } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { getSupabase } from '@/database/client'
import type { MCPEndpoint } from '@/types'
import { formatDate, generateId } from '@/lib/utils'

export default function MCPPage() {
  const { user } = useAuth()
  const [endpoints, setEndpoints] = useState<MCPEndpoint[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [protocol, setProtocol] = useState('http')

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    if (!user) return
    const supabase = getSupabase()
    if (!supabase) return
    const { data } = await supabase.from('mcp_endpoints').select('*').eq('user_id', user.id)
    setEndpoints(data || [])
  }

  async function handleCreate() {
    if (!user || !name.trim() || !url.trim()) return
    const endpoint: MCPEndpoint = {
      id: generateId(),
      user_id: user.id,
      name,
      url,
      protocol,
      status: 'inactive',
      created_at: new Date().toISOString(),
    }
    const supabase = getSupabase()
    if (!supabase) return
    const { error } = await supabase.from('mcp_endpoints').insert(endpoint)
    if (!error) {
      setEndpoints(prev => [...prev, endpoint])
      setShowCreate(false)
      setName('')
      setUrl('')
    }
  }

  async function handleDelete(id: string) {
    const supabase = getSupabase()
    if (supabase) await supabase.from('mcp_endpoints').delete().eq('id', id)
    setEndpoints(prev => prev.filter(e => e.id !== id))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">MCP Endpoints</h1>
          <p className="text-sm text-gray-500">Model Context Protocol integration</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Add Endpoint</Button>
      </div>

      {endpoints.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Network className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 text-gray-500">No MCP endpoints configured.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {endpoints.map(ep => (
            <Card key={ep.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle>{ep.name}</CardTitle>
                  {ep.status === 'active'
                    ? <Wifi className="h-5 w-5 text-green-500" />
                    : <WifiOff className="h-5 w-5 text-gray-400" />}
                </div>
                <CardDescription>{ep.protocol}://{ep.url}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-xs text-gray-500">Added {formatDate(ep.created_at)}</p>
                <Button size="sm" variant="danger" onClick={() => handleDelete(ep.id)}>
                  <Trash2 className="h-4 w-4" /> Remove
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add MCP Endpoint">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
            <input value={name} onChange={e => setName(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" placeholder="My MCP Server" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">URL</label>
            <input value={url} onChange={e => setUrl(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" placeholder="localhost:8080" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Protocol</label>
            <select value={protocol} onChange={e => setProtocol(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700">
              <option value="http">HTTP</option>
              <option value="https">HTTPS</option>
              <option value="grpc">gRPC</option>
            </select>
          </div>
          <Button onClick={handleCreate} className="w-full">Add Endpoint</Button>
        </div>
      </Modal>
    </div>
  )
}
