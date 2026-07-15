'use client'
import { useState, useEffect } from 'react'
import { Plus, Key, Trash2, Copy, Eye, EyeOff, Check, AlertCircle } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Modal, Input } from '@/components/ui'
import { localStore } from '@/lib/storage'
import { formatDate, generateId } from '@/lib/utils'

interface StoredApiKey {
  id: string
  name: string
  key: string
  provider: string
  created_at: string
  updated_at: string
}

const PROVIDER_PATTERNS: { pattern: RegExp; name: string }[] = [
  { pattern: /^sk-ant-/i, name: 'Anthropic' },
  { pattern: /^sk-proj-/i, name: 'OpenAI' },
  { pattern: /^sk-/i, name: 'OpenAI' },
  { pattern: /^gsk_/i, name: 'Groq' },
  { pattern: /^MISTRAL_/i, name: 'Mistral' },
  { pattern: /^ghp_/i, name: 'GitHub' },
  { pattern: /^github_pat_/i, name: 'GitHub' },
  { pattern: /^sbp_/i, name: 'Supabase' },
  { pattern: /^tvly-/i, name: 'Tavily' },
  { pattern: /^fir_/i, name: 'Fireworks AI' },
  { pattern: /^cerebras_/i, name: 'Cerebras' },
  { pattern: /^nvidia_/i, name: 'NVIDIA' },
  { pattern: /^xai-/i, name: 'xAI' },
  { pattern: /^ds_/i, name: 'DeepSeek' },
  { pattern: /^cf_/i, name: 'Cloudflare' },
]

function detectProvider(key: string): string {
  for (const { pattern, name } of PROVIDER_PATTERNS) {
    if (pattern.test(key.trim())) return name
  }
  return 'Custom'
}

function Label({ children, className = '', ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={`text-sm font-medium text-gray-700 dark:text-gray-300 ${className}`} {...props}>
      {children}
    </label>
  )
}

export default function ApiCenterPage() {
  const [keys, setKeys] = useState<StoredApiKey[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [editingKey, setEditingKey] = useState<StoredApiKey | null>(null)
  const [keyName, setKeyName] = useState('')
  const [keyValue, setKeyValue] = useState('')
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set())
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => { load() }, [])

  function load() {
    const stored = localStore.apiKeys.items.map(k => ({
      id: k.id,
      name: k.name,
      key: k.key,
      provider: (k as any).provider || (k as any).provider_name || detectProvider(k.key),
      created_at: (k as any).createdAt || new Date().toISOString(),
      updated_at: (k as any).updatedAt || new Date().toISOString(),
    }))
    setKeys(stored)
  }

  function handleAddClick() {
    setKeyName('')
    setKeyValue('')
    setEditingKey(null)
    setShowCreate(true)
    setSaveSuccess(false)
  }

  function handleSave() {
    if (!keyName.trim() || !keyValue.trim()) return
    const provider = detectProvider(keyValue)
    const now = new Date().toISOString()
    if (editingKey) {
      localStore.apiKeys.update(editingKey.id, { name: keyName, key: keyValue, provider, updatedAt: now } as any)
      setKeys(prev => prev.map(k => k.id === editingKey.id ? { ...k, name: keyName, key: keyValue, provider, updated_at: now } : k))
      setEditingKey(null)
    } else {
      const entry = { id: generateId(), name: keyName, key: keyValue, provider, createdAt: now, updatedAt: now }
      localStore.apiKeys.add(entry as any)
      setKeys(prev => [...prev, { id: entry.id, name: keyName, key: keyValue, provider, created_at: now, updated_at: now }])
    }
    setShowCreate(false)
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
  }

  function startEdit(apiKey: StoredApiKey) {
    setEditingKey(apiKey)
    setKeyName(apiKey.name)
    setKeyValue(apiKey.key)
    setShowCreate(true)
  }

  function handleDelete(id: string) {
    if (!confirm('Delete this API key?')) return
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">API Center</h1>
          <p className="text-sm text-gray-500">Store any API key — provider is auto-detected</p>
        </div>
        <Button onClick={handleAddClick}><Plus className="h-4 w-4 mr-1" /> Add API Key</Button>
      </div>

      {saveSuccess && (
        <div className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 px-4 py-3 text-sm text-green-700 dark:text-green-300">
          <Check className="h-4 w-4" /> Key saved successfully
        </div>
      )}

      {keys.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Key className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-2">No API keys yet.</p>
            <p className="text-gray-400 text-sm mb-4">Add any API key — the system will detect the provider automatically.</p>
            <Button onClick={handleAddClick}><Plus className="h-4 w-4 mr-1" /> Add First Key</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {keys.map(apiKey => (
            <Card key={apiKey.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="rounded bg-blue-100 dark:bg-blue-900/50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-200">
                        {apiKey.provider}
                      </span>
                      <h3 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{apiKey.name}</h3>
                      <span className="text-xs text-gray-500">{formatDate(apiKey.updated_at)}</span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <code className="rounded bg-gray-100 dark:bg-gray-800 px-3 py-1 text-sm font-mono text-gray-700 dark:text-gray-300 flex-1 min-w-0 truncate">
                        {visibleKeys.has(apiKey.id) ? apiKey.key : apiKey.key.slice(0, 8) + '••••••' + apiKey.key.slice(-4)}
                      </code>
                      <button onClick={() => toggleVisible(apiKey.id)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1" title={visibleKeys.has(apiKey.id) ? 'Hide' : 'Show'}>
                        {visibleKeys.has(apiKey.id) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                      <button onClick={() => copyKey(apiKey.key, apiKey.id)} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1" title="Copy">
                        <Copy className="h-4 w-4" />
                      </button>
                      {copiedId === apiKey.id && <span className="text-xs text-green-600">Copied!</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button size="sm" variant="secondary" onClick={() => startEdit(apiKey)}>Edit</Button>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(apiKey.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setEditingKey(null) }} title={editingKey ? 'Edit API Key' : 'Add API Key'}>
        <div className="space-y-4">
          <div>
            <Label htmlFor="keyName">Key Name</Label>
            <Input id="keyName" value={keyName} onChange={e => setKeyName(e.target.value)} placeholder="e.g. My OpenAI Key" />
          </div>
          <div>
            <Label htmlFor="keyValue">API Key Value</Label>
            <Input id="keyValue" type="password" value={keyValue} onChange={e => setKeyValue(e.target.value)} placeholder="Paste your API key here" />
          </div>
          {keyValue.trim() && (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm text-gray-600 dark:text-gray-400">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>Detected provider: <strong className="text-gray-900 dark:text-gray-100">{detectProvider(keyValue)}</strong></span>
            </div>
          )}
          <Button onClick={handleSave} className="w-full" disabled={!keyName.trim() || !keyValue.trim()}>
            {editingKey ? 'Update Key' : 'Save Key'}
          </Button>
        </div>
      </Modal>
    </div>
  )
}
