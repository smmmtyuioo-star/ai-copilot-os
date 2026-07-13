'use client'
import { useState } from 'react'
import { Globe, Search, ArrowRight, AlertCircle } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui'

export default function BrowserPage() {
  const [url, setUrl] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleFetch() {
    if (!url.trim()) return
    setLoading(true)
    setError('')
    setResult(null)

    try {
      const response = await fetch('/api/browser/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.startsWith('http') ? url : `https://${url}` }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error || 'Failed to fetch URL')
      } else {
        setResult(data.content)
      }
    } catch (err) {
      setError('Failed to connect. Check the URL and try again.')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Browser Automation</h1>
        <p className="text-sm text-gray-500">Fetch and interact with web pages</p>
      </div>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Globe className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleFetch() }}
                placeholder="Enter URL to fetch..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm dark:border-gray-600 dark:bg-gray-700"
              />
            </div>
            <Button onClick={handleFetch} loading={loading}>
              <Search className="h-4 w-4" /> Fetch
            </Button>
          </div>
        </CardContent>
      </Card>

      {error && (
        <Card>
          <CardContent className="flex items-start gap-3 text-red-600">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle>Page Content</CardTitle>
            <CardDescription>Fetched from {url}</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-y-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-4 text-xs dark:bg-gray-900">
              {result}
            </pre>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
