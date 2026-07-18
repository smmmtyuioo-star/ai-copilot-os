'use client'
import { useState } from 'react'
import { Sparkles, AlertCircle, Download, Eye, Code2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button } from '@/components/ui'

const IMG_KEY = 'ac_img_history'

function loadImgHistory(): { prompt: string; date: string; type: string }[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(IMG_KEY) || '[]') } catch { return [] }
}

function saveImgHistory(history: { prompt: string; date: string; type: string }[]) {
  try { localStorage.setItem(IMG_KEY, JSON.stringify(history)) } catch {}
}

export default function ImageStudioPage() {
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState('')
  const [htmlResult, setHtmlResult] = useState('')
  const [mode, setMode] = useState<'description' | 'visual'>('description')
  const [error, setError] = useState('')
  const [history, setHistory] = useState<{ prompt: string; date: string; type: string }[]>(loadImgHistory)
  const [showPreview, setShowPreview] = useState(false)

  async function handleGenerate() {
    if (!prompt.trim()) return
    setGenerating(true)
    setResult('')
    setHtmlResult('')
    setError('')
    setShowPreview(false)

    if (mode === 'visual') {
      try {
        const res = await fetch('/api/images/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt }),
        })
        const data = await res.json()
        if (data.success && data.html) {
          setHtmlResult(data.html)
          setResult('Visual generated as HTML/SVG')
        } else {
          setError(data.error || 'Generation failed')
        }
      } catch { setError('Network error') }
      setGenerating(false)
      setHistory(prev => { const next = [{ prompt, date: new Date().toLocaleTimeString(), type: 'visual' }, ...prev].slice(0, 20); saveImgHistory(next); return next })
      return
    }

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are an AI that describes images in vivid detail. Given a prompt, describe what the image would look like: composition, colors, lighting, mood, style. Also suggest how to create this image using HTML/CSS/SVG or DALL-E/Midjourney prompt format. Be creative and thorough.' },
          { role: 'user', content: prompt },
        ],
      }),
    })

    if (response.ok && response.body) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        const lines = text.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          const data = line.slice(6)
          if (data === '[DONE]') break
          try { const parsed = JSON.parse(data); setResult(prev => prev + (parsed.choices?.[0]?.delta?.content || '')) } catch {}
        }
      }
      setHistory(prev => { const next = [{ prompt, date: new Date().toLocaleTimeString(), type: 'description' }, ...prev].slice(0, 20); saveImgHistory(next); return next })
    } else {
      setError('Generation failed. Check your API key.')
    }
    setGenerating(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Image Studio</h1>
        <p className="text-sm text-gray-500">Generate visual descriptions or actual SVG/HTML visuals from text</p>
      </div>

      <Card className="bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800">
        <CardContent className="flex items-start gap-3 text-sm text-amber-800 dark:text-amber-200">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Note</p>
            <p>Description mode uses the LLM to describe images. Visual mode generates actual SVG/HTML renderings via AI — results are code-based visuals, not photographic.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create a Visual</CardTitle>
          <CardDescription>Describe what you want to see</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
              <button onClick={() => setMode('description')} className={`px-3 py-2 text-xs font-medium ${mode === 'description' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600'}`}><Eye className="h-3 w-3 inline mr-1" />Describe</button>
              <button onClick={() => setMode('visual')} className={`px-3 py-2 text-xs font-medium ${mode === 'visual' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600'}`}><Code2 className="h-3 w-3 inline mr-1" />Visual</button>
            </div>
          </div>

          <div className="flex gap-2">
            <input value={prompt} onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleGenerate() }}
              placeholder="A futuristic city with neon lights, cyberpunk style, rainy streets..."
              className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm dark:border-gray-600 dark:bg-gray-800" />
            <Button onClick={handleGenerate} loading={generating}>
              <Sparkles className="h-4 w-4" /> Generate
            </Button>
          </div>

          {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30"><AlertCircle className="h-4 w-4 inline mr-1" />{error}</div>}

          {htmlResult && mode === 'visual' && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge>SVG/HTML Visual</Badge>
                <button onClick={() => setShowPreview(!showPreview)} className="text-xs text-blue-600 hover:underline">{showPreview ? 'Show code' : 'Show preview'}</button>
                <button onClick={() => navigator.clipboard.writeText(htmlResult)} className="text-xs text-blue-600 hover:underline flex items-center gap-1 ml-auto"><Download className="h-3 w-3" /> Copy HTML</button>
              </div>
              {showPreview ? (
                <div className="rounded-xl border border-gray-200 overflow-hidden dark:border-gray-700">
                  <iframe srcDoc={htmlResult} className="w-full h-[500px]" title="Visual Preview" />
                </div>
              ) : (
                <pre className="max-h-96 overflow-auto rounded-xl border border-gray-200 bg-gray-50 p-4 text-xs font-mono dark:border-gray-700 dark:bg-gray-900">{htmlResult}</pre>
              )}
            </div>
          )}

          {result && mode === 'description' && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center justify-between mb-4">
                <Badge>AI Description</Badge>
                <button onClick={() => navigator.clipboard.writeText(result)} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <Download className="h-3 w-3" /> Copy
                </button>
              </div>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{result}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader><CardTitle>History ({history.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="flex items-center justify-between rounded border border-gray-200 p-2 text-sm dark:border-gray-700">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`text-xs px-1.5 py-0.5 rounded ${h.type === 'visual' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>{h.type === 'visual' ? 'SVG' : 'Desc'}</span>
                  <span className="truncate">{h.prompt}</span>
                </div>
                <span className="text-xs text-gray-400 shrink-0">{h.date}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
