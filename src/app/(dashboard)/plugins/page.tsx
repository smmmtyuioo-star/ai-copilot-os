'use client'
import { useState, useEffect } from 'react'
import { Puzzle, Download, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@/components/ui'
import { generateId } from '@/lib/utils'

interface Plugin {
  id: string
  name: string
  version: string
  description: string
  author: string
  verified: boolean
  installed: boolean
  icon: string
}

const AVAILABLE_PLUGINS: Plugin[] = [
  { id: 'code-analyzer', name: 'Code Analyzer', version: '1.0.0', description: 'Static code analysis for JavaScript, TypeScript, and Python', author: 'AI Copilot', verified: true, installed: false, icon: '🔍' },
  { id: 'data-exporter', name: 'Data Exporter', version: '1.2.0', description: 'Export conversations and data to CSV, JSON, Markdown', author: 'AI Copilot', verified: true, installed: false, icon: '📊' },
  { id: 'pdf-generator', name: 'PDF Generator', version: '0.9.0', description: 'Generate PDF documents from markdown and code', author: 'Community', verified: false, installed: false, icon: '📄' },
  { id: 'web-scraper', name: 'Web Scraper', version: '1.0.0', description: 'Extract structured data from web pages via AI', author: 'AI Copilot', verified: true, installed: false, icon: '🕸️' },
  { id: 'image-analyzer', name: 'Image Analyzer', version: '0.8.0', description: 'Analyze images and extract text via AI vision', author: 'Community', verified: false, installed: false, icon: '🖼️' },
  { id: 'note-taker', name: 'Note Taker', version: '1.1.0', description: 'Quick notes and knowledge snippets manager', author: 'AI Copilot', verified: true, installed: false, icon: '📝' },
  { id: 'api-tester', name: 'API Tester', version: '1.0.0', description: 'Test REST APIs directly from the copilot', author: 'AI Copilot', verified: true, installed: false, icon: '🔌' },
  { id: 'translator', name: 'Translator', version: '1.0.0', description: 'Translate text between 50+ languages using AI', author: 'Community', verified: false, installed: false, icon: '🌐' },
]

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<Plugin[]>([])
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    const installed = JSON.parse(localStorage.getItem('ac_plugins') || '[]')
    const merged = AVAILABLE_PLUGINS.map(p => ({ ...p, installed: installed.includes(p.id) }))
    setPlugins(merged)
  }, [])

  function saveState(list: Plugin[]) {
    setPlugins(list)
    const installed = list.filter(p => p.installed).map(p => p.id)
    localStorage.setItem('ac_plugins', JSON.stringify(installed))
  }

  function install(id: string) {
    saveState(plugins.map(p => p.id === id ? { ...p, installed: true } : p))
    const plugin = plugins.find(p => p.id === id)
    setMessage({ type: 'success', text: `"${plugin?.name}" installed successfully` })
    setTimeout(() => setMessage(null), 3000)
  }

  function uninstall(id: string) {
    saveState(plugins.map(p => p.id === id ? { ...p, installed: false } : p))
    const plugin = plugins.find(p => p.id === id)
    setMessage({ type: 'success', text: `"${plugin?.name}" uninstalled` })
    setTimeout(() => setMessage(null), 3000)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Plugin Marketplace</h1>
        <p className="text-sm text-gray-500">Extend the copilot with community plugins</p>
      </div>

      {message && (
        <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${
          message.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/30' : 'bg-red-50 text-red-700 dark:bg-red-900/30'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plugins.map(plugin => (
          <Card key={plugin.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{plugin.icon}</span>
                  <CardTitle className="text-sm">{plugin.name}</CardTitle>
                </div>
                <Badge variant={plugin.verified ? 'success' : 'warning'}>
                  {plugin.verified ? 'Verified' : 'Community'}
                </Badge>
              </div>
              <CardDescription>v{plugin.version} by {plugin.author}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{plugin.description}</p>
              {plugin.installed ? (
                <Button size="sm" variant="danger" onClick={() => uninstall(plugin.id)}>
                  <Trash2 className="h-4 w-4" /> Uninstall
                </Button>
              ) : (
                <Button size="sm" onClick={() => install(plugin.id)}>
                  <Download className="h-4 w-4" /> Install
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
