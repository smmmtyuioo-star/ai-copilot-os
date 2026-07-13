'use client'
import { useState } from 'react'
import { Image, Sparkles, Download, RotateCcw, AlertCircle, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, Input } from '@/components/ui'
import { generateId } from '@/lib/utils'

interface Generation {
  id: string
  prompt: string
  url: string
  model: string
  timestamp: string
}

export default function ImageStudioPage() {
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [image, setImage] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<Generation[]>([])

  async function handleGenerate() {
    if (!prompt.trim()) return
    setGenerating(true)
    setImage(null)
    setError('')

    // Use AI to generate a description/image - for real image generation, connect to a provider
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are an image generation assistant. When given a prompt, describe what the image would look like in vivid detail. Include composition, colors, style, and mood. Format with markdown.' },
          { role: 'user', content: `Generate an image of: ${prompt}` },
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
        setImage(result)
        setHistory(prev => [{
          id: generateId(), prompt, url: '',
          model: 'llama-3.3-70b-versatile (description)',
          timestamp: new Date().toISOString(),
        }, ...prev])
      }
    } else {
      setError('Generation failed. Check your API key.')
    }
    setGenerating(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Image & Video Studio</h1>
        <p className="text-sm text-gray-500">Generate and edit images with AI</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Image</CardTitle>
          <CardDescription>Describe what you want to create</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input value={prompt} onChange={e => setPrompt(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleGenerate() }}
              placeholder="A futuristic city with neon lights, cyberpunk style..."
              className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm dark:border-gray-600 dark:bg-gray-800" />
            <Button onClick={handleGenerate} loading={generating}>
              <Sparkles className="h-4 w-4" /> Generate
            </Button>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30">
              <AlertCircle className="h-4 w-4" /> {error}
            </div>
          )}

          {image && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center justify-between mb-3">
                <Badge>AI Generated</Badge>
                <button onClick={() => { navigator.clipboard.writeText(image) }} className="text-xs text-blue-600 hover:underline">Copy</button>
              </div>
              <div className="prose prose-sm max-w-none dark:prose-invert" dangerouslySetInnerHTML={{ __html: image.replace(/\n/g, '<br/>') }} />
            </div>
          )}
        </CardContent>
      </Card>

      {history.length > 1 && (
        <Card>
          <CardHeader><CardTitle>Generation History ({history.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700">
                <div className="flex-1">
                  <p className="font-medium truncate">{h.prompt}</p>
                  <p className="text-xs text-gray-500">{h.model}</p>
                </div>
                <span className="text-xs text-gray-400">{new Date(h.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
