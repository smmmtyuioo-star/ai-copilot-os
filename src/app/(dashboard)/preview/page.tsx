'use client'
import { useState } from 'react'
import { Play, RefreshCw, Smartphone, Tablet, Monitor, Code, Globe, Sparkles, Maximize2, AlertCircle, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '@/components/ui'

type InputMode = 'code' | 'url' | 'prompt'

export default function PreviewPage() {
  const [input, setInput] = useState('')
  const [mode, setMode] = useState<InputMode>('code')
  const [preview, setPreview] = useState('')
  const [previewUrl, setPreviewUrl] = useState('')
  const [device, setDevice] = useState('desktop')
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [genPreview, setGenPreview] = useState('')

  async function handlePreview() {
    if (!input.trim()) return
    setRunning(true)
    setError('')
    setPreview('')
    setPreviewUrl('')
    setGenPreview('')

    if (mode === 'url') {
      const url = input.startsWith('http') ? input : `https://${input}`
      setPreviewUrl(url)
      setRunning(false)
      return
    }

    if (mode === 'code') {
      if (input.includes('<') || input.includes('{')) {
        setPreview(input)
        setRunning(false)
        return
      }
    }

    // AI generate from prompt or non-HTML code input
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You generate complete, working HTML documents with inline CSS and JavaScript. The code must be self-contained in a single HTML file. For games: use Canvas API or DOM. For websites: include navigation, styling, and content. For apps: include interactivity and state management. Output ONLY the raw HTML code inside ```html...``` block. Make it visually polished and fully functional.' },
          { role: 'user', content: input },
        ],
      }),
    })

    if (response.ok) {
      const reader = response.body?.getReader()
      if (reader) {
        const decoder = new TextDecoder()
        let result = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const text = decoder.decode(value)
          const lines = text.split('\n').filter(l => l.startsWith('data: '))
          for (const line of lines) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              result += parsed.choices?.[0]?.delta?.content || ''
            } catch {}
          }
        }
        const htmlMatch = result.match(/```html?([\s\S]*?)```/) || result.match(/<html[\s\S]*?<\/html>/)
        const html = htmlMatch ? (htmlMatch[1] || htmlMatch[0]).trim() : result
        if (html.startsWith('<')) {
          setPreview(html)
          setGenPreview(html)
        } else {
          setPreview(`<html><body><pre>${result}</pre></body></html>`)
        }
      }
    } else {
      setError('Failed to generate preview.')
    }
    setRunning(false)
  }

  const deviceStyles: Record<string, string> = {
    desktop: 'w-full h-[600px]',
    tablet: 'w-[768px] h-[600px]',
    mobile: 'w-[375px] h-[600px]',
  }

  const iframeSandbox = 'allow-scripts allow-same-origin allow-forms allow-popups'

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Live Preview</h1>
        <p className="text-sm text-gray-500">Run websites, games, and apps — code, URL, or AI-generated</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Input</CardTitle>
                <CardDescription>Enter code, URL, or describe what to build</CardDescription>
              </div>
              <div className="flex gap-1 rounded-lg border border-gray-200 p-0.5 dark:border-gray-700">
                {[
                  { id: 'code' as InputMode, icon: Code, label: 'Code' },
                  { id: 'url' as InputMode, icon: Globe, label: 'URL' },
                  { id: 'prompt' as InputMode, icon: Sparkles, label: 'AI Prompt' },
                ].map(m => {
                  const Icon = m.icon
                  return (
                    <button key={m.id} onClick={() => setMode(m.id)}
                      className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${mode === m.id ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                      <Icon className="h-3 w-3" /> {m.label}
                    </button>
                  )
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === 'url' ? (
              <div className="flex gap-2">
                <input value={input} onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handlePreview() }}
                  placeholder="https://example.com" className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" />
              </div>
            ) : (
              <textarea value={input} onChange={e => setInput(e.target.value)}
                placeholder={mode === 'code' ? '<div>Hello World</div>\n\nPaste HTML here...' : 'Build a breakout game with Canvas, score tracking, and levels...'}
                rows={8} className="w-full rounded-lg border border-gray-300 p-3 text-sm font-mono dark:border-gray-600 dark:bg-gray-800" />
            )}
            <Button onClick={handlePreview} loading={running} className="w-full">
              {mode === 'url' ? <Globe className="h-4 w-4" /> : mode === 'code' ? <Code className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
              {mode === 'url' ? 'Load URL' : mode === 'code' ? 'Preview' : 'Generate & Preview'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Preview</CardTitle>
                <CardDescription>{previewUrl ? 'Embedded URL' : preview ? 'Rendered output' : 'Ready'}</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex gap-1 rounded-lg border border-gray-200 p-1 dark:border-gray-700">
                  {[
                    { id: 'desktop', icon: Monitor },
                    { id: 'tablet', icon: Tablet },
                    { id: 'mobile', icon: Smartphone },
                  ].map(d => {
                    const Icon = d.icon
                    return (
                      <button key={d.id} onClick={() => setDevice(d.id)}
                        className={`p-1.5 rounded ${device === d.id ? 'bg-gray-200 dark:bg-gray-700' : ''}`} title={d.id}>
                        <Icon className="h-4 w-4" />
                      </button>
                    )
                  })}
                </div>
                {(preview || previewUrl) && (
                  <button onClick={() => setFullscreen(!fullscreen)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800" title="Toggle fullscreen">
                    <Maximize2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}
            {previewUrl ? (
              <div className={`overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 ${fullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-950' : deviceStyles[device]} mx-auto transition-all`}>
                <iframe src={previewUrl} className="h-full w-full bg-white" title="URL Preview" sandbox={iframeSandbox} />
                {fullscreen && <button onClick={() => setFullscreen(false)} className="absolute top-4 right-4 rounded-lg bg-black/50 px-3 py-1.5 text-sm text-white hover:bg-black/70">Exit Fullscreen</button>}
              </div>
            ) : preview ? (
              <div className={`overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 ${fullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-950' : deviceStyles[device]} mx-auto transition-all`}>
                <iframe srcDoc={preview} className="h-full w-full bg-white" title="Preview" sandbox={iframeSandbox} />
                {fullscreen && <button onClick={() => setFullscreen(false)} className="absolute top-4 right-4 rounded-lg bg-black/50 px-3 py-1.5 text-sm text-white hover:bg-black/70">Exit Fullscreen</button>}
              </div>
            ) : (
              <div className="flex h-[400px] items-center justify-center text-gray-400">
                <div className="text-center">
                  <Monitor className="mx-auto h-10 w-10 mb-2" />
                  <p className="text-sm">Enter HTML, a URL, or describe an app/game</p>
                  <p className="text-xs mt-1 text-gray-500">AI can build anything: websites, games, dashboards, tools</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {genPreview && (
        <Card>
          <CardHeader>
            <CardTitle>Generated Source</CardTitle>
            <CardDescription>Click copy to use this code</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-48 overflow-y-auto rounded-lg bg-gray-50 p-3 text-xs dark:bg-gray-900">
              <code>{genPreview.slice(0, 3000)}{genPreview.length > 3000 ? '... (truncated)' : ''}</code>
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
