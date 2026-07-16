'use client'
import { useState } from 'react'
import { Search, Globe, CheckCircle2, AlertCircle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button } from '@/components/ui'
import { generateId } from '@/lib/utils'

interface Analysis {
  url: string
  title: string
  summary: string
  tech: string[]
  topics: string[]
  verified: boolean
  content: string
}

const WEB_KEY = 'ac_web'

function loadWebState(): { analysis: Analysis | null; searchResult: string } {
  if (typeof window === 'undefined') return { analysis: null, searchResult: '' }
  try { return JSON.parse(localStorage.getItem(WEB_KEY) || '{"analysis":null,"searchResult":""}') } catch { return { analysis: null, searchResult: '' } }
}

function saveWebState(analysis: Analysis | null, searchResult: string) {
  try { localStorage.setItem(WEB_KEY, JSON.stringify({ analysis, searchResult })) } catch {}
}

export default function WebIntelligencePage() {
  const [url, setUrl] = useState('')
  const [query, setQuery] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [searching, setSearching] = useState(false)
  const [analysis, setAnalysis] = useState<Analysis | null>(loadWebState().analysis)
  const [searchResult, setSearchResult] = useState(loadWebState().searchResult || '')
  const [error, setError] = useState('')

  async function handleAnalyze() {
    if (!url.trim()) return
    setAnalyzing(true)
    setAnalysis(null)
    setError('')

    const targetUrl = url.startsWith('http') ? url : `https://${url}`
    try {
      const fetchRes = await fetch('/api/browser/fetch', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      })
      if (!fetchRes.ok) {
        setError(`Could not fetch URL: ${fetchRes.status}. The site may block automated access.`)
        setAnalyzing(false)
        return
      }
      const fetchData = await fetchRes.json()
      const pageContent = fetchData.content || ''

      const aiRes = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'Analyze this webpage content. Return JSON only: {"title":"...","summary":"...","tech":["..."],"topics":["..."],"verified":true/false}. Summary is 2-3 sentences.' },
            { role: 'user', content: `URL: ${targetUrl}\n\nContent: ${pageContent.slice(0, 8000)}` },
          ],
        }),
      })
      let result = { title: targetUrl, summary: '', tech: [] as string[], topics: [] as string[], verified: false }
      if (aiRes.ok) {
        const aiData = await aiRes.json()
        try { result = JSON.parse(aiData.choices?.[0]?.message?.content || '{}') } catch {}
      }
      const newAnalysis: Analysis = { url: targetUrl, ...result, content: pageContent.slice(0, 2000) }
      setAnalysis(newAnalysis)
      saveWebState(newAnalysis, searchResult)
    } catch (err) {
      setError(`Failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    }
    setAnalyzing(false)
  }

  async function handleSearch() {
    if (!query.trim()) return
    setSearching(true)
    setSearchResult('')
    setError('')

    const response = await fetch('/api/ai/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'You are a knowledgeable AI assistant. Based on your training data, provide a comprehensive answer about the user\'s query. Include relevant facts, technologies, and concepts. Structure your response with sections. Note: I answer from training data, not live web browsing.' },
          { role: 'user', content: query },
        ],
      }),
    })

    if (response.ok && response.body) {
      const reader = response.body.getReader()
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
          try { const parsed = JSON.parse(data); result += parsed.choices?.[0]?.delta?.content || ''; setSearchResult(prev => prev + (parsed.choices?.[0]?.delta?.content || '')) } catch (e) { console.error('Web stream parse error:', e) }
        }
      }
      saveWebState(analysis, result)
    }
    setSearching(false)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Web & AI</h1>
        <p className="text-sm text-gray-500">Fetch real URLs or ask the AI for information</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Analyze a URL</CardTitle>
            <CardDescription>Fetches the real webpage and analyzes it with AI</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <input value={url} onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAnalyze() }}
                placeholder="https://example.com" className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" />
              <Button onClick={handleAnalyze} loading={analyzing}><Globe className="h-4 w-4" /></Button>
            </div>
            {error && <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-600"><AlertCircle className="h-4 w-4" />{error}</div>}
            {analysis && (
              <div className="space-y-3 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
                <div className="flex items-center gap-2">
                  {analysis.verified ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <AlertCircle className="h-5 w-5 text-yellow-500" />}
                  <span className="font-medium text-sm">{analysis.title}</span>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400">{analysis.summary}</p>
                <div className="flex flex-wrap gap-1">
                  {analysis.tech.map(t => <Badge key={t} variant="info">{t}</Badge>)}
                  {analysis.topics.map(t => <Badge key={t}>{t}</Badge>)}
                </div>
                <details>
                  <summary className="text-xs text-blue-600 cursor-pointer">Raw content preview</summary>
                  <pre className="mt-1 max-h-24 overflow-y-auto rounded bg-gray-50 p-2 text-xs dark:bg-gray-900">{analysis.content.slice(0, 1000)}</pre>
                </details>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Ask AI</CardTitle>
            <CardDescription>Ask questions and get AI-generated answers from its training data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <input value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
                placeholder="What technologies should I use for..."
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" />
              <Button onClick={handleSearch} loading={searching}><Search className="h-4 w-4" /></Button>
            </div>
            {searchResult && (
              <div className="rounded-lg bg-blue-50 p-4 text-sm dark:bg-blue-900/30">
                <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{searchResult}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
