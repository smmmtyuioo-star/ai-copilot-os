'use client'
import { useState } from 'react'
import { Sparkles, AlertCircle, Download } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button, Input } from '@/components/ui'
import { generateId } from '@/lib/utils'

const IMG_KEY = 'ac_img_history'

function loadImgHistory(): { prompt: string; date: string }[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(IMG_KEY) || '[]') } catch { return [] }
}

function saveImgHistory(history: { prompt: string; date: string }[]) {
  try { localStorage.setItem(IMG_KEY, JSON.stringify(history)) } catch {}
}

export default function ImageStudioPage() {
  const [prompt, setPrompt] = useState('')
  const [generating, setGenerating] = useState(false)
  const [result, setResult] = useState('')
  const [error, setError] = useState('')
  const [history, setHistory] = useState<{ prompt: string; date: string }[]>(loadImgHistory)

  async function handleGenerate() {
    if (!prompt.trim()) return
    setGenerating(true)
    setResult('')
    setError('')

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
      let output = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        const lines = text.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          const data = line.slice(6)
          if (data === '[DONE]') break
          try { const parsed = JSON.parse(data); output += parsed.choices?.[0]?.delta?.content || ''; setResult(prev => prev + (parsed.choices?.[0]?.delta?.content || '')) } catch {}
        }
      }
      setHistory(prev => { const next = [{ prompt, date: new Date().toLocaleTimeString() }, ...prev].slice(0, 20); saveImgHistory(next); return next })
    } else {
      setError('Generation failed. Check your API key.')
    }
    setGenerating(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">AI Visual Description Generator</h1>
        <p className="text-sm text-gray-500">Generate detailed visual descriptions and creative prompts from text</p>
      </div>

      <Card className="bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800">
        <CardContent className="flex items-start gap-3 text-sm text-yellow-800 dark:text-yellow-200">
          <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">Note</p>
            <p>Groq does not generate actual images. The AI will describe the image in detail and suggest how to create it with SVG/HTML or image generation tools like DALL-E/Midjourney.</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Describe an Image</CardTitle>
          <CardDescription>Describe the scene you have in mind, and AI will generate a detailed visual description</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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

          {result && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-700 dark:bg-gray-900">
              <div className="flex items-center justify-between mb-4">
                <Badge>AI Generated Description</Badge>
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
                <span className="truncate">{h.prompt}</span>
                <span className="text-xs text-gray-400">{h.date}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
