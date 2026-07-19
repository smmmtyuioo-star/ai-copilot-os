'use client'
import { useState, useEffect, useRef } from 'react'
import { Download, Trash2, CheckCircle2, AlertCircle, Play, Copy, Search } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Modal } from '@/components/ui'
import { generateId } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

interface Plugin {
  id: string
  name: string
  version: string
  description: string
  author: string
  verified: boolean
  installed: boolean
  icon: string
  category: string
  autoInject?: boolean
}

interface PluginAction {
  plugin: Plugin
  loading: boolean
  input: string
  output: string
  error: string
}

const AVAILABLE_PLUGINS: Plugin[] = [
  { id: 'code-analyzer', name: 'Code Analyzer', version: '1.0.0', description: 'Analyze code for bugs, security issues, and improvements using AI', author: 'AI Copilot', verified: true, installed: false, icon: '🔍', category: 'Development' },
  { id: 'data-exporter', name: 'Data Exporter', version: '1.2.0', description: 'Export conversations, memory, and knowledge to CSV or JSON files', author: 'AI Copilot', verified: true, installed: false, icon: '📊', category: 'Utility' },
  { id: 'translator', name: 'AI Translator', version: '1.0.0', description: 'Translate text between languages using AI with context awareness', author: 'AI Copilot', verified: true, installed: false, icon: '🌐', category: 'Utility' },
  { id: 'web-scraper', name: 'Web Scraper', version: '1.0.0', description: 'Fetch and extract structured content from any web URL', author: 'AI Copilot', verified: true, installed: false, icon: '🕸️', category: 'Data' },
  { id: 'api-tester', name: 'API Tester', version: '1.0.0', description: 'Send HTTP requests to APIs and view formatted responses', author: 'AI Copilot', verified: true, installed: false, icon: '🔌', category: 'Development' },
  { id: 'note-taker', name: 'Note Taker', version: '1.1.0', description: 'Capture quick notes, ideas, and snippets into the knowledge base', author: 'AI Copilot', verified: true, installed: false, icon: '📝', category: 'Productivity' },
  { id: 'pdf-generator', name: 'Doc Generator', version: '0.9.0', description: 'Generate formatted documents and export as Markdown or HTML', author: 'Community', verified: false, installed: false, icon: '📄', category: 'Utility' },
  { id: 'image-analyzer', name: 'Image Analyzer', version: '0.8.0', description: 'Describe images and extract text using AI vision analysis', author: 'Community', verified: false, installed: false, icon: '🖼️', category: 'Media' },
  { id: 'summarizer', name: 'Text Summarizer', version: '1.0.0', description: 'Summarize long text, articles, or documents into key points', author: 'AI Copilot', verified: true, installed: false, icon: '📋', category: 'Utility' },
  { id: 'regex-tester', name: 'Regex Builder', version: '1.0.0', description: 'Build and test regular expressions with AI assistance', author: 'AI Copilot', verified: true, installed: false, icon: '🔤', category: 'Development' },
]

const PLUGIN_ACTIONS: Record<string, { label: string; inputLabel: string; inputPlaceholder: string; systemPrompt: string; buttonLabel: string }> = {
  'code-analyzer': { label: 'Analyze Code', inputLabel: 'Paste your code', inputPlaceholder: 'function hello() { console.log("world") }', systemPrompt: 'Analyze this code for: 1) Bugs and errors 2) Security vulnerabilities 3) Performance issues 4) Best practices violations 5) Suggestions for improvement. Format with bullet points.', buttonLabel: 'Analyze' },
  'data-exporter': { label: 'Export Data', inputLabel: 'What to export?', inputPlaceholder: 'Type "conversations", "memory", "knowledge", or "all"', systemPrompt: 'You are a data exporter. Generate a formatted JSON/CSV export of the requested data type. If the user asks for conversations, provide sample conversation data structure. If knowledge, provide knowledge items structure.', buttonLabel: 'Export' },
  'translator': { label: 'Translate Text', inputLabel: 'Text to translate (specify target language)', inputPlaceholder: 'Translate this to Spanish: Hello, how are you?', systemPrompt: 'Translate the given text to the requested language. Preserve formatting and tone. Provide only the translation and a brief note about any cultural nuances.', buttonLabel: 'Translate' },
  'web-scraper': { label: 'Scrape URL', inputLabel: 'Enter URL to scrape', inputPlaceholder: 'https://example.com', systemPrompt: 'You are a web scraping assistant. Given a URL, describe what content you would extract from it and how you would structure the data.', buttonLabel: 'Scrape' },
  'api-tester': { label: 'Test API', inputLabel: 'API request details', inputPlaceholder: 'GET https://api.example.com/users', systemPrompt: 'You are an API testing assistant. Given an HTTP request (method, URL, headers, body), simulate what the response would look like and describe the expected behavior. Include status code, headers, and body format.', buttonLabel: 'Send' },
  'note-taker': { label: 'Quick Note', inputLabel: 'Write a note', inputPlaceholder: 'Remember to update the authentication module...', systemPrompt: 'Save this note and format it nicely. Include a title, date, and tags based on the content. Return it as a formatted note.', buttonLabel: 'Save Note' },
  'pdf-generator': { label: 'Generate Document', inputLabel: 'Describe the document', inputPlaceholder: 'A user manual for a REST API with authentication...', systemPrompt: 'Generate a well-structured document in Markdown format based on the description. Include headings, sections, and proper formatting. The document should be ready to export.', buttonLabel: 'Generate' },
  'image-analyzer': { label: 'Describe Image', inputLabel: 'Describe the image or paste image URL', inputPlaceholder: 'A photo of a sunset over mountains with a lake reflection', systemPrompt: 'Describe this image in vivid detail. Include: composition, colors, lighting, objects, atmosphere, and emotional impact. Then suggest how it could be analyzed further.', buttonLabel: 'Analyze' },
  'summarizer': { label: 'Summarize Text', inputLabel: 'Paste the text to summarize', inputPlaceholder: 'Long article or document text here...', systemPrompt: 'Summarize the given text into: 1) One-sentence summary 2) Key points (bullet list) 3) Main takeaway. Be concise and preserve important details.', buttonLabel: 'Summarize' },
  'regex-tester': { label: 'Build Regex', inputLabel: 'Describe what you want to match', inputPlaceholder: 'Match email addresses in a text', systemPrompt: 'Generate a regular expression for the described pattern. Explain how it works, show examples of matches and non-matches, and note any edge cases.', buttonLabel: 'Generate Regex' },
}

export default function PluginsPage() {
  const { user } = useAuth()
  const [plugins, setPlugins] = useState<Plugin[]>(() => {
    const key = user ? `ac_plugins_${user.id}` : 'ac_plugins'
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '[]')
      const installed = new Map<string, StoredPlugin>(
        (Array.isArray(raw) ? raw : []).map((s: any) => [typeof s === 'string' ? s : s.id, typeof s === 'string' ? { id: s, autoInject: false } : s])
      )
      return AVAILABLE_PLUGINS.map(p => {
        const stored = installed.get(p.id)
        return { ...p, installed: !!stored, autoInject: stored?.autoInject || false }
      })
    } catch {
      return AVAILABLE_PLUGINS.map(p => ({ ...p, installed: false, autoInject: false }))
    }
  })
  const initialized = useRef(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [action, setAction] = useState<PluginAction | null>(null)
  const [filter, setFilter] = useState('all')
  const [pluginSearch, setPluginSearch] = useState('')

  function pluginStorageKey() {
    return user ? `ac_plugins_${user.id}` : 'ac_plugins'
  }

  useEffect(() => {
    if (!initialized.current) { initialized.current = true; return }
    const key = user ? `ac_plugins_${user.id}` : 'ac_plugins'
    try {
      const raw = JSON.parse(localStorage.getItem(key) || '[]')
      const installed = new Map<string, StoredPlugin>(
        (Array.isArray(raw) ? raw : []).map((s: any) => [typeof s === 'string' ? s : s.id, typeof s === 'string' ? { id: s, autoInject: false } : s])
      )
      setPlugins(AVAILABLE_PLUGINS.map(p => {
        const stored = installed.get(p.id)
        return { ...p, installed: !!stored, autoInject: stored?.autoInject || false }
      }))
    } catch { /* silent */ }
  }, [user])

  interface StoredPlugin { id: string; autoInject: boolean }

  function saveState(list: Plugin[]) {
    setPlugins(list)
    const stored: StoredPlugin[] = list.filter(p => p.installed).map(p => ({ id: p.id, autoInject: p.autoInject || false }))
    localStorage.setItem(pluginStorageKey(), JSON.stringify(stored))
  }

  function enable(id: string) {
    saveState(plugins.map(p => p.id === id ? { ...p, installed: true, autoInject: false } : p))
    const plugin = plugins.find(p => p.id === id)
    setMessage({ type: 'success', text: `"${plugin?.name}" enabled — click Use to run it` })
    setTimeout(() => setMessage(null), 3000)
  }

  function disable(id: string) {
    saveState(plugins.map(p => p.id === id ? { ...p, installed: false, autoInject: false } : p))
    if (action?.plugin.id === id) setAction(null)
  }

  function toggleAutoInject(id: string) {
    saveState(plugins.map(p => p.id === id ? { ...p, autoInject: !p.autoInject } : p))
  }

  async function executeAction() {
    if (!action || !action.input.trim()) return
    setAction({ ...action, loading: true, output: '', error: '' })

    const config = PLUGIN_ACTIONS[action.plugin.id]
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: config.systemPrompt },
          { role: 'user', content: action.input },
        ],
      }),
    })

    if (response.ok && response.body) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let output = ''
      setAction(prev => prev ? { ...prev, output: '', loading: false } : prev)
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        const lines = text.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          const data = line.slice(6)
          if (data === '[DONE]') break
          try { const parsed = JSON.parse(data); const token = parsed.choices?.[0]?.delta?.content || ''; output += token; setAction(prev => prev ? { ...prev, output: prev.output + token } : prev) } catch {}
        }
      }
    } else {
      const err = await response.json().catch(() => ({ error: 'Unknown error' }))
      setAction(prev => prev ? { ...prev, error: `Plugin failed: ${err.error || 'API error'}. Check your API key or try again.`, loading: false } : prev)
    }
  }

  const categories = [...new Set(plugins.map(p => p.category))]
  const filtered = filter === 'all' ? plugins : plugins.filter(p => p.category === filter)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Plugin Presets</h1>
        <p className="text-sm text-gray-500">Prompt presets — not actual code plugins.</p>
      </div>

      {message && (
        <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Discover Plugins</CardTitle>
          <CardDescription>Search for plugins in the marketplace</CardDescription>
          <div className="relative mt-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={pluginSearch} onChange={e => setPluginSearch(e.target.value)}
              placeholder="Search plugins (e.g. code, translate, export...)"
              className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm dark:border-gray-600 dark:bg-gray-700" />
          </div>
        </CardHeader>
        {pluginSearch.length >= 2 && (
          <CardContent>
            <div className="space-y-1">
              {AVAILABLE_PLUGINS.filter(p =>
                p.name.toLowerCase().includes(pluginSearch) ||
                p.description.toLowerCase().includes(pluginSearch) ||
                p.category.toLowerCase().includes(pluginSearch)
              ).slice(0, 5).map(p => {
                const installed = plugins.find(x => x.id === p.id)?.installed
                return (
                  <div key={p.id} className="flex items-center justify-between p-2 rounded-lg border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800">
                    <div className="flex items-center gap-2">
                      <span>{p.icon}</span>
                      <span className="text-sm font-medium">{p.name}</span>
                      <span className="text-xs text-gray-400">{p.category}</span>
                    </div>
                    <button onClick={() => { if (!installed) enable(p.id); setPluginSearch('') }}
                      className={`text-xs ${installed ? 'text-green-600' : 'text-blue-600 hover:underline'}`}>
                      {installed ? 'Enabled' : 'Enable'}
                    </button>
                  </div>
                )
              })}
              {AVAILABLE_PLUGINS.filter(p =>
                p.name.toLowerCase().includes(pluginSearch) ||
                p.description.toLowerCase().includes(pluginSearch) ||
                p.category.toLowerCase().includes(pluginSearch)
              ).length === 0 && (
                <p className="text-xs text-gray-400 py-2 text-center">No plugins found</p>
              )}
            </div>
          </CardContent>
        )}
      </Card>

      <div className="flex gap-2 overflow-x-auto pb-2">
        <button onClick={() => setFilter('all')} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${filter === 'all' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800'}`}>All</button>
        {categories.map(c => (
          <button key={c} onClick={() => setFilter(c)} className={`rounded-lg px-3 py-1.5 text-xs font-medium ${filter === c ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800'}`}>{c}</button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(plugin => {
          const isActionOpen = action?.plugin.id === plugin.id
          return (
            <Card key={plugin.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{plugin.icon}</span>
                    <div>
                      <CardTitle className="text-sm">{plugin.name}</CardTitle>
                      <CardDescription>{plugin.category}</CardDescription>
                    </div>
                  </div>
                  <Badge variant={plugin.verified ? 'success' : 'warning'}>{plugin.verified ? 'Verified' : 'Community'}</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{plugin.description}</p>
                <p className="mb-3 text-xs text-gray-400">v{plugin.version} by {plugin.author}</p>
                  {plugin.installed ? (
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => setAction({ plugin, loading: false, input: '', output: '', error: '' })}>
                      <Play className="h-4 w-4" /> Use
                    </Button>
                    <Button size="sm" variant={plugin.autoInject ? 'primary' : 'secondary'} onClick={() => toggleAutoInject(plugin.id)}
                      title={plugin.autoInject ? 'Auto-inject into chat' : 'Click to auto-inject'}>
                      <span className={`h-3 w-3 rounded-full ${plugin.autoInject ? 'bg-green-500' : 'bg-gray-300'}`} /> Auto
                    </Button>
                    <Button size="sm" variant="danger" onClick={() => disable(plugin.id)}>
                      <Trash2 className="h-4 w-4" /> Disable
                    </Button>
                  </div>
                ) : (
                    <Button size="sm" onClick={() => enable(plugin.id)}>
                    <Download className="h-4 w-4" /> Enable
                  </Button>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {action && (
        <Modal open={!!action} onClose={() => setAction(null)} title={`${action.plugin.icon} ${action.plugin.name}`}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">{action.plugin.description}</p>
            {(() => {
              const config = PLUGIN_ACTIONS[action.plugin.id]
              return (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-1">{config.inputLabel}</label>
                    <textarea value={action.input} onChange={e => setAction(prev => prev ? { ...prev, input: e.target.value } : prev)}
                      placeholder={config.inputPlaceholder} rows={4}
                      className="w-full rounded-lg border border-gray-300 p-3 text-sm dark:border-gray-600 dark:bg-gray-800" />
                  </div>
                  <Button onClick={executeAction} className="w-full" loading={action.loading} disabled={!action.input.trim()}>
                    <Play className="h-4 w-4" /> {config.buttonLabel}
                  </Button>
                  {action.error && <p className="text-sm text-red-500">{action.error}</p>}
                  {action.output && (
                    <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-500">Output</span>
                        <button onClick={() => navigator.clipboard.writeText(action.output)} className="text-xs text-blue-600 hover:underline"><Copy className="h-3 w-3 inline" /> Copy</button>
                      </div>
                      <pre className="whitespace-pre-wrap text-sm max-h-60 overflow-y-auto">{action.output}</pre>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </Modal>
      )}
    </div>
  )
}
