'use client'
import { useState, useEffect } from 'react'
import { Play, CheckCircle2, Circle, Loader2, AlertCircle, FileText, Bug, Shield, Zap, Brain, Search, Code, TestTube, Rocket, RefreshCw, Monitor, Maximize2, Copy, Sparkles } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button } from '@/components/ui'
import { generateId } from '@/lib/utils'

const STAGES = [
  { id: 'analyze', name: 'Requirement Analysis', icon: Search, prompt: 'Analyze the following request and extract: 1) Core requirements 2) Technical constraints 3) Success criteria. Be specific and actionable.' },
  { id: 'plan', name: 'Architecture Planning', icon: Brain, prompt: 'Design a high-level architecture for this project. Define: 1) Component tree 2) Data flow 3) API endpoints needed 4) Database schema.' },
  { id: 'design', name: 'System Design', icon: FileText, prompt: 'Create detailed technical specifications for each component. Include: file structure, key interfaces, and data models.' },
  { id: 'frontend', name: 'Frontend Development', icon: Code, prompt: 'Generate the frontend implementation plan. List: 1) UI components needed 2) State management approach 3) Styling strategy 4) Key implementation files.' },
  { id: 'backend', name: 'Backend Development', icon: Code, prompt: 'Generate the backend implementation plan. List: 1) API routes 2) Business logic classes 3) Database queries 4) Authentication approach.' },
  { id: 'integrate', name: 'Integration', icon: Zap, prompt: 'Describe how frontend and backend components connect. Define: API contracts, data formats, error handling patterns.' },
  { id: 'test', name: 'Testing Strategy', icon: TestTube, prompt: 'Create a testing plan covering: 1) Unit tests 2) Integration tests 3) Edge cases 4) Testing tools and frameworks.' },
  { id: 'debug', name: 'Quality Review', icon: Bug, prompt: 'Review the design for: 1) Potential bugs 2) Performance issues 3) Security vulnerabilities 4) Edge cases not handled.' },
  { id: 'review', name: 'Final Review', icon: Shield, prompt: 'Perform a final quality check. Verify: 1) All requirements covered 2) Architecture is sound 3) No security issues 4) Ready for development.' },
  { id: 'deploy', name: 'Deployment Plan', icon: Rocket, prompt: 'Create a deployment plan: 1) Hosting strategy 2) Environment variables needed 3) CI/CD pipeline 4) Monitoring setup.' },
]

interface StageResult {
  id: string
  status: 'pending' | 'running' | 'completed' | 'error'
  output?: string
  duration?: string
}

export default function BuildPage() {
  const [prompt, setPrompt] = useState('')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<StageResult[]>([])
  const [builds, setBuilds] = useState<{ id: string; prompt: string; date: string }[]>([])
  const [fullOutput, setFullOutput] = useState('')
  const [preview, setPreview] = useState('')
  const [previewRunning, setPreviewRunning] = useState(false)
  const [fullscreen, setFullscreen] = useState(false)
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop')

  // Load prompt from localStorage (set by chat /build command)
  useEffect(() => {
    const stored = localStorage.getItem('ac_build_prompt')
    if (stored) {
      setPrompt(stored)
      localStorage.removeItem('ac_build_prompt')
    }
  }, [])

  async function startBuild() {
    if (!prompt.trim() || running) return
    setRunning(true)
    setFullOutput('')
    setResults(STAGES.map(s => ({ id: s.id, status: 'pending' })))
    setPreview('')

    for (let i = 0; i < STAGES.length; i++) {
      const stage = STAGES[i]
      setResults(prev => prev.map(r => r.id === stage.id ? { ...r, status: 'running' } : r))

      const startTime = Date.now()
      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: `You are the "${stage.name}" agent in a software build pipeline. ${stage.prompt} Be concise but thorough. Use bullet points.` },
              { role: 'user', content: prompt },
            ],
          }),
        })

        let output = ''
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
              try { const parsed = JSON.parse(data); output += parsed.choices?.[0]?.delta?.content || '' } catch {}
            }
          }
        }

        const duration = ((Date.now() - startTime) / 1000).toFixed(1)
        setResults(prev => prev.map(r => r.id === stage.id ? { id: stage.id, status: 'completed', output, duration: `${duration}s` } : r))
        setFullOutput(prev => prev + `\n## ${stage.name} (${duration}s)\n${output}\n`)

        // After frontend and backend stages, generate live preview code
        if (stage.id === 'backend' || stage.id === 'integrate') {
          generateLivePreview()
        }
      } catch {
        setResults(prev => prev.map(r => r.id === stage.id ? { id: stage.id, status: 'error', output: 'Stage failed' } : r))
      }
    }

    // Final preview generation
    generateLivePreview()

    setBuilds(prev => [{ id: generateId(), prompt: prompt.slice(0, 60), date: new Date().toLocaleDateString() }, ...prev].slice(0, 10))
    setRunning(false)
  }

  async function generateLivePreview() {
    setPreviewRunning(true)
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: `Generate a COMPLETE, WORKING single-file HTML application based on the build pipeline output. 
Include: HTML structure, inline CSS (modern, responsive, dark/light mode), and inline JavaScript.
Make it a REAL working app - not a mockup. Use modern ES6+, CSS Grid/Flexbox, semantic HTML.
Output ONLY the raw HTML code inside \`\`\`html...\`\`\` block. No explanations.` },
            { role: 'user', content: `Build pipeline output:\n${fullOutput}\n\nOriginal request: ${prompt}` },
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
              try { const parsed = JSON.parse(data); result += parsed.choices?.[0]?.delta?.content || '' } catch {}
            }
          }
          const htmlMatch = result.match(/```html?([\s\S]*?)```/) || result.match(/<html[\s\S]*?<\/html>/)
          const html = htmlMatch ? (htmlMatch[1] || htmlMatch[0]).trim() : result
          if (html.startsWith('<')) setPreview(html)
        }
      }
    } finally {
      setPreviewRunning(false)
    }
  }

  async function generatePreviewManually() {
    if (!fullOutput) return
    await generateLivePreview()
  }

  const deviceStyles: Record<'desktop' | 'tablet' | 'mobile', string> = {
    desktop: 'w-full h-[600px]',
    tablet: 'w-[768px] h-[600px]',
    mobile: 'w-[375px] h-[600px]',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Build Pipeline</h1>
        <p className="text-sm text-gray-500">Each stage runs real AI analysis — no fake progress. Live preview generates working code.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-3 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>What do you want to build?</CardTitle>
              <CardDescription>Describe your project and AI will analyze every aspect</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea value={prompt} onChange={e => setPrompt(e.target.value)}
                placeholder="Describe your app, feature, or system to build..."
                rows={4}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm dark:border-gray-600 dark:bg-gray-800" />
              <Button onClick={startBuild} loading={running} className="w-full">
                <Play className="h-4 w-4" /> {running ? 'Building...' : 'Start Real Build'}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-1">
            {STAGES.map((stage, i) => {
              const result = results.find(r => r.id === stage.id)
              const Icon = stage.icon
              const isActive = result?.status === 'running'
              const isDone = result?.status === 'completed'
              const isError = result?.status === 'error'
              return (
                <div key={stage.id} className={`flex items-start gap-3 rounded-lg p-3 transition-colors ${
                  isActive ? 'bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-800' :
                  isDone ? 'bg-green-50/50 dark:bg-green-900/10' :
                  isError ? 'bg-red-50 dark:bg-red-900/20' : ''
                }`}>
                  <div className="shrink-0 mt-0.5">
                    {isActive ? <Loader2 className="h-5 w-5 animate-spin text-blue-500" /> :
                     isDone ? <CheckCircle2 className="h-5 w-5 text-green-500" /> :
                     isError ? <AlertCircle className="h-5 w-5 text-red-500" /> :
                     <Circle className="h-5 w-5 text-gray-300" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-4 w-4 ${isActive ? 'text-blue-500' : isDone ? 'text-green-500' : 'text-gray-400'}`} />
                      <span className={`text-sm font-medium ${isActive ? 'text-blue-700 dark:text-blue-300' : isDone ? 'text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-400'}`}>
                        {stage.name}
                      </span>
                      {result?.duration && <span className="text-xs text-gray-400">{result.duration}</span>}
                    </div>
                    {result?.output && (
                      <details className="mt-1">
                        <summary className="text-xs text-blue-600 cursor-pointer hover:underline">View output</summary>
                        <pre className="mt-1 rounded bg-gray-50 p-2 text-xs whitespace-pre-wrap max-h-40 overflow-y-auto dark:bg-gray-900">{result.output}</pre>
                      </details>
                    )}
                  </div>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <div key={j} className={`h-1.5 w-3 rounded-full ${
                        isDone ? 'bg-green-400' : isActive && j === 0 ? 'bg-blue-400 animate-pulse' : 'bg-gray-200 dark:bg-gray-700'
                      }`} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {fullOutput && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Complete Build Report</CardTitle>
                  <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(fullOutput)}>
                    <Copy className="h-4 w-4" /> Copy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-xs max-h-96 overflow-y-auto rounded bg-gray-50 p-4 dark:bg-gray-900">{fullOutput}</pre>
              </CardContent>
            </Card>
          )}

          {builds.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Recent Builds</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {builds.map(b => (
                  <div key={b.id} className="flex items-center justify-between rounded border border-gray-200 p-2 text-sm dark:border-gray-700">
                    <span className="truncate">{b.prompt}</span>
                    <span className="text-xs text-gray-400">{b.date}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Live Preview</CardTitle>
                  <CardDescription>Generated working app from build output</CardDescription>
                </div>
                <div className="flex items-center gap-2">
<div className="flex gap-1 rounded-lg border border-gray-200 p-1 dark:border-gray-700">
                    {[
                      { id: 'desktop' as const, icon: <Monitor className="h-4 w-4" /> },
                      { id: 'tablet' as const, icon: <Monitor className="h-4 w-4" style={{ transform: 'scale(0.7)' }} /> },
                      { id: 'mobile' as const, icon: <Monitor className="h-4 w-4" style={{ transform: 'scale(0.5)' }} /> },
                    ].map(d => (
                      <button key={d.id} onClick={() => setDevice(d.id)}
                        className={`p-1.5 rounded ${device === d.id ? 'bg-gray-200 dark:bg-gray-700' : ''}`} title={d.id}>
                        {d.icon}
                      </button>
                    ))}
                  </div>
                  {preview && (
                    <button onClick={() => setFullscreen(!fullscreen)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-800" title="Toggle fullscreen">
                      <Maximize2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {previewRunning && (
                <div className="flex items-center justify-center py-8 text-blue-600">
                  <Loader2 className="h-6 w-6 animate-spin" /> Generating live preview...
                </div>
              )}
              {preview ? (
                <div className={`overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700 ${deviceStyles[device]} mx-auto transition-all ${fullscreen ? 'fixed inset-0 z-50 bg-white dark:bg-gray-950' : ''}`}>
                  <iframe srcDoc={preview} className="h-full w-full bg-white" title="Live Preview" sandbox="allow-scripts allow-same-origin allow-forms allow-popups" />
                  {fullscreen && (
                    <button onClick={() => setFullscreen(false)} className="absolute top-4 right-4 rounded-lg bg-black/50 px-3 py-1.5 text-sm text-white hover:bg-black/70">
                      Exit Fullscreen
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex h-[400px] items-center justify-center text-gray-400">
                  <div className="text-center">
                    <Sparkles className="mx-auto h-10 w-10 mb-2" />
                    <p className="text-sm">Run a build to generate live preview</p>
                    <p className="text-xs mt-1">Or click "Generate Preview" after build completes</p>
                  </div>
                </div>
              )}
              {(fullOutput && !previewRunning) && (
                <Button onClick={generatePreviewManually} className="w-full mt-4" variant="secondary" loading={previewRunning}>
                  <Sparkles className="h-4 w-4" /> Generate Live Preview
                </Button>
              )}
            </CardContent>
          </Card>

          {fullOutput && !preview && !previewRunning && (
            <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-900/20">
              <CardContent className="py-3 text-center text-sm text-blue-700 dark:text-blue-300">
                💡 Build complete! Click "Generate Live Preview" to create a working app from the pipeline output.
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}