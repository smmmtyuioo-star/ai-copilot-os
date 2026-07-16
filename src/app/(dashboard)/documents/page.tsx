'use client'
import { useState, useRef } from 'react'
import { Upload, FileText, Search, Brain, Download, Trash2, Loader2, AlertCircle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button } from '@/components/ui'
import { formatBytes, generateId } from '@/lib/utils'

interface Document {
  id: string
  name: string
  type: string
  size: number
  status: 'uploaded' | 'processing' | 'indexed' | 'error'
  content?: string
  summary?: string
  chunks?: number
  error?: string
}

const DOCS_KEY = 'ac_documents'

function loadDocs(): Document[] {
  if (typeof window === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(DOCS_KEY) || '[]') } catch { return [] }
}

function saveDocs(docs: Document[]) {
  try { localStorage.setItem(DOCS_KEY, JSON.stringify(docs)) } catch {}
}

export default function DocumentsPage() {
  const [docs, setDocs] = useState<Document[]>(loadDocs)
  const [analyzing, setAnalyzing] = useState('')
  const [query, setQuery] = useState('')
  const [answer, setAnswer] = useState('')
  const [answering, setAnswering] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function updateDocs(updater: (prev: Document[]) => Document[]) {
    setDocs(prev => { const next = updater(prev); saveDocs(next); return next })
  }

  async function handleUpload(file: File) {
    const doc: Document = {
      id: generateId(), name: file.name, type: file.type,
      size: file.size, status: 'uploaded',
    }

    const binaryTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument', 'image/']
    const isBinary = binaryTypes.some(t => file.type.startsWith(t)) ||
      /\.(pdf|docx?|xlsx?|pptx?|png|jpe?g|gif|bmp|zip|rar)$/i.test(file.name)
    if (isBinary) {
      doc.status = 'error'
      doc.error = `Binary format (${file.type || file.name.split('.').pop()}) not supported yet. Upload plain text (TXT, CSV, MD, JSON, etc.)`
      setAnalyzing('')
      updateDocs(prev => [doc, ...prev])
      return
    }

    updateDocs(prev => [doc, ...prev])
    setAnalyzing(doc.id)

    const text = await file.text().catch(() => '')
    const content = text.slice(0, 50000)
    doc.content = content
    doc.status = 'processing'

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Analyze this document and provide: 1) Summary (2-3 sentences) 2) Key topics 3) Document type. Be concise.' },
          { role: 'user', content: `Document: ${content.slice(0, 10000)}` },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Analysis failed' }))
      doc.status = 'error'
      doc.error = err.error || 'Analysis failed'
      setAnalyzing('')
      updateDocs(prev => [...prev])
      return
    }

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
      doc.summary = result
    }

    doc.chunks = Math.ceil(content.length / 1000)
    doc.status = 'indexed'
    setAnalyzing('')
    updateDocs(prev => [...prev])
  }

  async function handleAsk() {
    if (!query.trim() || docs.length === 0) return
    setAnswering(true)
    setAnswer('')

    const context = docs
      .filter(d => d.status === 'indexed' && d.content)
      .map(d => `[${d.name}]: ${d.content?.slice(0, 2000)}`)
      .join('\n\n')

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Answer questions based on the provided documents. Cite sources. If information is not in the documents, say so.' },
          { role: 'user', content: `Documents:\n${context.slice(0, 15000)}\n\nQuestion: ${query}` },
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.json().catch(() => ({ error: 'Query failed' }))
      setAnswer(`Error: ${err.error || 'Query failed'}`)
      setAnswering(false)
      return
    }

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
            const token = parsed.choices?.[0]?.delta?.content || ''
            if (token) { result += token; setAnswer(prev => prev + token) }
          } catch {}
        }
      }
    }
    setAnswering(false)
  }

  function removeDoc(id: string) {
    updateDocs(prev => prev.filter(d => d.id !== id))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Document Intelligence</h1>
        <p className="text-sm text-gray-500">Upload, analyze, and query documents with AI</p>
      </div>

      <Card>
        <CardContent className="py-8">
          <div
            onClick={() => fileRef.current?.click()}
            className="flex cursor-pointer flex-col items-center gap-3 rounded-xl border-2 border-dashed border-gray-300 p-8 hover:border-blue-400 dark:border-gray-600"
          >
            <Upload className="h-8 w-8 text-gray-400" />
            <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Drop files or click to upload</p>
            <p className="text-xs text-gray-500">TXT, CSV, Markdown, JSON, JS/TS, and other text files. Binary files (PDF, DOCX, images) are recognized but content preview requires rendering support.</p>
            <input ref={fileRef} type="file" multiple className="hidden"
              accept=".pdf,.docx,.txt,.csv,.md,.png,.jpg,.jpeg"
              onChange={e => { const files = Array.from(e.target.files || []); files.forEach(f => handleUpload(f)); e.target.value = '' }} />
          </div>
        </CardContent>
      </Card>

      {docs.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Documents ({docs.length})</h2>
          {docs.map(doc => (
            <Card key={doc.id}>
              <CardContent className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-blue-600" />
                    <span className="font-medium">{doc.name}</span>
                    <Badge variant={doc.status === 'indexed' ? 'success' : doc.status === 'error' ? 'error' : 'info'}>
                      {doc.status}
                    </Badge>
                    <span className="text-xs text-gray-500">{formatBytes(doc.size)}</span>
                  </div>
                  {analyzing === doc.id && (
                    <div className="mt-2 flex items-center gap-2 text-sm text-blue-600">
                      <Loader2 className="h-4 w-4 animate-spin" /> Analyzing...
                    </div>
                  )}
                  {doc.error && (
                    <p className="mt-2 text-sm text-red-500 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> {doc.error}</p>
                  )}
                  {doc.summary && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{doc.summary}</p>
                  )}
                  {doc.chunks && <p className="mt-1 text-xs text-gray-500">{doc.chunks} chunks indexed</p>}
                </div>
                <button onClick={() => removeDoc(doc.id)} className="text-gray-400 hover:text-red-500">
                  <Trash2 className="h-4 w-4" />
                </button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {docs.some(d => d.status === 'indexed') && (
        <Card>
          <CardHeader>
            <CardTitle>Ask your documents</CardTitle>
            <CardDescription>Query all uploaded documents</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <input value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAsk() }}
                placeholder="Ask a question about your documents..."
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm dark:border-gray-600 dark:bg-gray-800" />
              <Button onClick={handleAsk} loading={answering}><Search className="h-4 w-4" /> Ask</Button>
            </div>
            {answer && (
              <div className="rounded-lg bg-blue-50 p-4 text-sm dark:bg-blue-900/30">
                <div className="flex items-start gap-2">
                  <Brain className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
                  <p className="whitespace-pre-wrap text-gray-700 dark:text-gray-300">{answer}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
