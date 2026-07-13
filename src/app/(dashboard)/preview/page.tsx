'use client'
import { useState } from 'react'
import { Play, RefreshCw, Smartphone, Tablet, Monitor, Code, Terminal, AlertCircle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button } from '@/components/ui'

export default function PreviewPage() {
  const [code, setCode] = useState('')
  const [preview, setPreview] = useState('')
  const [device, setDevice] = useState('desktop')
  const [error, setError] = useState('')
  const [running, setRunning] = useState(false)

  async function handlePreview() {
    if (!code.trim()) return
    setRunning(true)
    setError('')
    setPreview('')

    if (code.includes('<') || code.includes('{')) {
      // HTML preview
      setPreview(code)
      setRunning(false)
      return
    }

    // Use AI to generate code from description
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Generate a complete, working HTML page with inline CSS and JS for the given description. ONLY output the HTML code, no explanations.' },
          { role: 'user', content: code },
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
        setPreview(htmlMatch ? htmlMatch[1] || htmlMatch[0] : `<html><body><pre>${result}</pre></body></html>`)
      }
    } else {
      setError('Failed to generate preview.')
    }
    setRunning(false)
  }

  const deviceStyles = {
    desktop: 'w-full h-[600px]',
    tablet: 'w-[768px] h-[600px]',
    mobile: 'w-[375px] h-[600px]',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Live Preview</h1>
        <p className="text-sm text-gray-500">Preview generated apps and code in real-time</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Code / Prompt</CardTitle>
            <CardDescription>Enter HTML code or describe what to build</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <textarea
              value={code} onChange={e => setCode(e.target.value)}
              placeholder={'<div>Hello World</div>\n\nOr describe: "Build a login form with email and password fields..."'}
              rows={10}
              className="w-full rounded-lg border border-gray-300 p-3 text-sm font-mono dark:border-gray-600 dark:bg-gray-800"
            />
            <Button onClick={handlePreview} loading={running} className="w-full">
              <Play className="h-4 w-4" /> Preview
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Preview</CardTitle>
                <CardDescription>Rendered output</CardDescription>
              </div>
              <div className="flex gap-1 rounded-lg border border-gray-200 p-1 dark:border-gray-700">
                {[
                  { id: 'desktop', icon: Monitor },
                  { id: 'tablet', icon: Tablet },
                  { id: 'mobile', icon: Smartphone },
                ].map(d => {
                  const Icon = d.icon
                  return (
                    <button key={d.id} onClick={() => setDevice(d.id)}
                      className={`p-1.5 rounded ${device === d.id ? 'bg-gray-200 dark:bg-gray-700' : ''}`}>
                      <Icon className="h-4 w-4" />
                    </button>
                  )
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/30">
                <AlertCircle className="h-4 w-4" /> {error}
              </div>
            )}
            {preview ? (
              <div className={`overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 ${deviceStyles[device as keyof typeof deviceStyles]} mx-auto transition-all`}>
                <iframe srcDoc={preview} className="h-full w-full bg-white" title="Preview" sandbox="allow-scripts" />
              </div>
            ) : (
              <div className="flex h-[400px] items-center justify-center text-gray-400">
                <p className="text-sm">Enter code or a description and click Preview</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
