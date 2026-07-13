'use client'
import { useState, useEffect } from 'react'
import { Search, Trash2, Brain, Eraser } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { getRecentMemory, searchMemory, deleteMemory, clearMemory } from '@/services/memory'
import type { MemoryEntry } from '@/types'
import { formatDate, truncate } from '@/lib/utils'

export default function MemoryPage() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<MemoryEntry[]>([])
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    if (!user) return
    setLoading(true)
    const data = await getRecentMemory(user.id)
    setEntries(data)
    setLoading(false)
  }

  async function handleSearch() {
    if (!user || !query.trim()) { load(); return }
    setLoading(true)
    const data = await searchMemory(user.id, query)
    setEntries(data)
    setLoading(false)
  }

  async function handleDelete(id: string) {
    await deleteMemory(id)
    setEntries(prev => prev.filter(e => e.id !== id))
  }

  async function handleClear() {
    if (!user || !confirm('Clear all memory entries?')) return
    await clearMemory(user.id)
    setEntries([])
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Memory</h1>
          <p className="text-sm text-gray-500">Short-term and long-term memory with search</p>
        </div>
        <Button variant="danger" onClick={handleClear}><Eraser className="h-4 w-4" /> Clear All</Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
            placeholder="Search memory..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm dark:border-gray-600 dark:bg-gray-700"
          />
        </div>
        <Button onClick={handleSearch} variant="secondary">Search</Button>
      </div>

      {loading ? (
        <Card><CardContent className="py-8 text-center text-gray-500">Loading...</CardContent></Card>
      ) : entries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Brain className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 text-gray-500">No memory entries yet. Chat with AI to create memories.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map(entry => (
            <Card key={entry.id}>
              <CardContent className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={entry.type === 'long-term' ? 'info' : 'default'}>{entry.type}</Badge>
                    <span className="text-xs text-gray-500">{formatDate(entry.created_at)}</span>
                  </div>
                  <p className="text-sm text-gray-900 dark:text-gray-100">{truncate(entry.content, 300)}</p>
                </div>
                <button onClick={() => handleDelete(entry.id)} className="shrink-0 text-gray-400 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
