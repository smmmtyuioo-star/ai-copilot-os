'use client'
import { useState } from 'react'
import { Brain, Search, BookmarkPlus, Trash2, BookOpen, Link, FileText, MessageSquare, Globe, Image as ImageIcon } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button } from '@/components/ui'
import { generateId, formatDate } from '@/lib/utils'

interface KnowledgeItem {
  id: string
  type: 'document' | 'web' | 'chat' | 'image' | 'note'
  title: string
  content: string
  source?: string
  tags: string[]
  createdAt: string
}

const TYPES = [
  { id: 'all', label: 'All', icon: Brain },
  { id: 'document', label: 'Documents', icon: FileText },
  { id: 'web', label: 'Web', icon: Globe },
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'image', label: 'Images', icon: ImageIcon },
  { id: 'note', label: 'Notes', icon: BookOpen },
]

export default function KnowledgePage() {
  const [items, setItems] = useState<KnowledgeItem[]>([])
  const [filter, setFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [note, setNote] = useState('')
  const [selected, setSelected] = useState<KnowledgeItem | null>(null)

  function addNote() {
    if (!note.trim()) return
    const item: KnowledgeItem = {
      id: generateId(), type: 'note', title: note.slice(0, 60),
      content: note, tags: [], createdAt: new Date().toISOString(),
    }
    setItems(prev => [item, ...prev])
    setNote('')
  }

  function deleteItem(id: string) {
    setItems(prev => prev.filter(i => i.id !== id))
    if (selected?.id === id) setSelected(null)
  }

  const filtered = items.filter(i => {
    if (filter !== 'all' && i.type !== filter) return false
    if (search && !i.title.toLowerCase().includes(search.toLowerCase()) && !i.content.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Knowledge Base</h1>
        <p className="text-sm text-gray-500">Searchable memory for documents, research, and notes</p>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search knowledge base..." className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm dark:border-gray-600 dark:bg-gray-800" />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-2">
        {TYPES.map(t => {
          const Icon = t.icon
          return (
            <button key={t.id} onClick={() => setFilter(t.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap ${
                filter === t.id ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400'
              }`}>
              <Icon className="h-3.5 w-3.5" /> {t.label} {t.id !== 'all' && `(${items.filter(i => i.type === t.id).length})`}
            </button>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-3">
          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Brain className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-2 text-gray-500">No knowledge items yet. Add notes or save research.</p>
              </CardContent>
            </Card>
          ) : (
            filtered.map(item => (
              <Card key={item.id}>
                <CardContent className="flex items-start justify-between gap-3">
                  <div className="flex-1 cursor-pointer" onClick={() => setSelected(item)}>
                    <div className="flex items-center gap-2">
                      <Badge variant={
                        item.type === 'document' ? 'info' : item.type === 'web' ? 'success' :
                        item.type === 'chat' ? 'default' : item.type === 'image' ? 'warning' : 'default'
                      }>{item.type}</Badge>
                      <span className="font-medium text-sm">{item.title}</span>
                      <span className="text-xs text-gray-400">{formatDate(item.createdAt)}</span>
                    </div>
                    <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{item.content}</p>
                    {item.source && <p className="mt-1 text-xs text-blue-500">{item.source}</p>}
                    {item.tags.length > 0 && (
                      <div className="mt-1 flex gap-1">
                        {item.tags.map(t => <span key={t} className="text-xs text-gray-400">#{t}</span>)}
                      </div>
                    )}
                  </div>
                  <button onClick={() => deleteItem(item.id)} className="shrink-0 text-gray-400 hover:text-red-500">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Quick Note</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <textarea value={note} onChange={e => setNote(e.target.value)}
                placeholder="Write a quick note..."
                rows={4} className="w-full rounded-lg border border-gray-300 p-3 text-sm dark:border-gray-600 dark:bg-gray-800" />
              <Button onClick={addNote} className="w-full" size="sm"><BookmarkPlus className="h-4 w-4" /> Save Note</Button>
            </CardContent>
          </Card>

          {selected && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Badge>{selected.type}</Badge>
                  <CardTitle className="text-sm">{selected.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{selected.content}</p>
                {selected.source && (
                  <p className="mt-2 text-xs text-blue-500">Source: {selected.source}</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
