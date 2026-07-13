'use client'
import { useState, useEffect } from 'react'
import { Plus, Key, Trash2, Copy, Eye, EyeOff } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Modal } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { localStore, hasSupabase } from '@/lib/storage'
import { getSupabase } from '@/database/client'
import type { ApiKey } from '@/types'
import { formatDate, generateId } from '@/lib/utils'

const PERMISSIONS = ['read', 'write', 'admin', 'ai:chat', 'ai:agent', 'workflows:execute', 'connectors:manage']

export default function ApiCenterPage() {
  const { user } = useAuth()
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [keyName, setKeyName] = useState('')
  const [selectedPerms, setSelectedPerms] = useState<string[]>(['read'])
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    if (!user) return
    if (hasSupabase) {
      const supabase = getSupabase()
      if (supabase) {
        const { data } = await supabase.from('api_keys').select('*').eq('user_id', user.id)
        if (data) { setKeys(data); return }
      }
    }
    setKeys(localStore.apiKeys.items.map(k => ({
      id: k.id, user_id: user.id, name: k.name, key: k.key,
      permissions: k.permissions, created_at: k.createdAt,
    })))
  }

  async function handleCreate() {
    if (!user || !keyName.trim()) return
    const apiKey: ApiKey = {
      id: generateId(), user_id: user.id, name: keyName,
      key: `aco_${generateId().replace(/-/g, '')}_${generateId().replace(/-/g, '')}`,
      permissions: selectedPerms, created_at: new Date().toISOString(),
    }
    if (hasSupabase) {
      const supabase = getSupabase()
      if (supabase) {
        const { error } = await supabase.from('api_keys').insert(apiKey)
        if (!error) { setKeys(prev => [...prev, apiKey]); setShowCreate(false); setKeyName(''); return }
      }
    }
    localStore.apiKeys.add({ id: apiKey.id, name: keyName, key: apiKey.key, permissions: selectedPerms, createdAt: apiKey.created_at })
    setKeys(prev => [...prev, apiKey])
    setShowCreate(false)
    setKeyName('')
  }

  async function handleDelete(id: string) {
    if (hasSupabase) {
      const supabase = getSupabase()
      if (supabase) await supabase.from('api_keys').delete().eq('id', id)
    }
    localStore.apiKeys.remove(id)
    setKeys(prev => prev.filter(k => k.id !== id))
  }

  function toggleVisible(id: string) {
    setVisibleKeys(prev => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }

  async function copyKey(key: string, id: string) {
    await navigator.clipboard.writeText(key)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  function togglePermission(perm: string) {
    setSelectedPerms(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm])
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">API Center</h1>
          <p className="text-sm text-gray-500">Manage API keys and access</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> New API Key</Button>
      </div>

      {keys.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Key className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 text-gray-500">No API keys created yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {keys.map(apiKey => (
            <Card key={apiKey.id}>
              <CardContent>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100">{apiKey.name}</h3>
                      <span className="text-xs text-gray-500">Created {formatDate(apiKey.created_at)}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <code className="rounded bg-gray-100 px-3 py-1 text-sm font-mono dark:bg-gray-700">
                        {visibleKeys.has(apiKey.id) ? apiKey.key : `${apiKey.key.slice(0, 12)}...${apiKey.key.slice(-4)}`}
                      </code>
                      <button onClick={() => toggleVisible(apiKey.id)} className="text-gray-400 hover:text-gray-600">
                        {visibleKeys.has(apiKey.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button onClick={() => copyKey(apiKey.key, apiKey.id)} className="text-gray-400 hover:text-gray-600">
                        <Copy className="h-4 w-4" />
                      </button>
                      {copiedId === apiKey.id && <span className="text-xs text-green-600">Copied!</span>}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {apiKey.permissions.map(p => (
                        <span key={p} className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900 dark:text-blue-200">{p}</span>
                      ))}
                    </div>
                  </div>
                  <Button size="sm" variant="danger" onClick={() => handleDelete(apiKey.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create API Key">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Key Name</label>
            <input value={keyName} onChange={e => setKeyName(e.target.value)} className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700" placeholder="My API Key" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Permissions</label>
            <div className="flex flex-wrap gap-2">
              {PERMISSIONS.map(p => (
                <button key={p} onClick={() => togglePermission(p)}
                  className={`rounded-lg border px-3 py-1 text-xs font-medium ${selectedPerms.includes(p) ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200' : 'border-gray-300 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400'}`}>{p}</button>
              ))}
            </div>
          </div>
          <Button onClick={handleCreate} className="w-full">Create Key</Button>
        </div>
      </Modal>
    </div>
  )
}
