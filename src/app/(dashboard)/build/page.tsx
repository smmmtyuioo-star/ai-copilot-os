'use client'
import { useState } from 'react'
import { Play, CheckCircle2, Circle, Loader2, AlertCircle, FileText, Bug, Shield, Zap, Brain, Search, Code, TestTube, Rocket, RefreshCw, Monitor, Maximize2, Copy } from 'lucide-react'
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

const PREVIEW_STAGES = ['frontend', 'backend', 'integrate', 'test']

interface StageResult {
  id: string
  status: 'pending' | 'running' | 'completed' | 'error'
  output?: string
  duration?: string
}

interface BuildState {
  prompt: string
  running: boolean
  results: StageResult[]
  builds: { id: string; prompt: string; date: string }[]
  fullOutput: string
  previewHtml: string
  previewRunning: boolean
}

export default function BuildPage() {
  const [state, setState] = useState<BuildState>({
    prompt: '', running: false, results: [], builds: [], fullOutput: '', previewHtml: '', previewRunning: false,
  })

  function updateState(partial: Partial<BuildState>) {
    setState(prev => ({ ...prev, ...partial }))
  }

  async function startBuild() {
    if (!state.prompt.trim() || state.running) return
    updateState({ running: true, fullOutput: '', results: STAGES.map(s => ({ id: s.id, status: 'pending' })), previewHtml: '', previewRunning: true })

    for (let i = 0; i < STAGES.length; i++) {
      const stage = STAGES[i]
      updateState({ results: state.results.map(r => r.id === stage.id ? { ...r, status: 'running' } : r) })

      const startTime = Date.now()
      try {
        const response = await fetch('/api/ai/chat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            messages: [
              { role: 'system', content: `You are the "${stage.name}" agent in a software build pipeline. ${stage.prompt} Be concise but thorough. Use bullet points.` },
              { role: 'user', content: state.prompt },
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
        updateState({
          results: state.results.map(r => r.id === stage.id ? { id: stage.id, status: 'completed', output, duration: `${duration}s` } : r),
          fullOutput: state.fullOutput + `\n## ${stage.name} (${duration}s)\n${output}\n`,
        })

        // Generate live preview after frontend/backend/integrate stages
        if (PREVIEW_STAGES.includes(stage.id) && state.previewRunning) {
          await generatePreview()
        }
      } catch {
        updateState({ results: state.results.map(r => r.id === stage.id ? { id: stage.id, status: 'error', output: 'Stage failed' } : r) })
      }
    }

    updateState({
      running: false, previewRunning: false,
      builds: [{ id: generateId(), prompt: state.prompt.slice(0, 60), date: new Date().toLocaleDateString() }, ...state.builds].slice(0, 10),
    })
    // Final preview generation
    await generatePreview()
  }

  async function generatePreview() {
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'Generate a complete, working HTML page with inline CSS and JS for the project. Include: modern responsive design, interactive elements, clean code. Output ONLY the raw HTML inside ```html...``` block. No explanations.' },
            { role: 'user', content: `Build this project:\n${state.prompt}\n\nBuild report so far:\n${state.fullOutput}\n\nCreate a working demo/prototype.` },
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
            try { const parsed = JSON.parse(data); result += parsed.choices?.[0]?.delta?.content || '' } catch {}
          }
        }
        const htmlMatch = result.match(/```html?([\s\S]*?)```/) || result.match(/<html[\s\S]*?<\/html>/)
        const html = htmlMatch ? (htmlMatch[1] || htmlMatch[0]).trim() : `<html><body><pre>${result}</pre></body></html>`
        updateState({ previewHtml: html })
      }
    } catch {
      updateState({ previewHtml: '<html><body><h3>Preview generation failed</h3></body></html>' })
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Build Pipeline</h1>
        <p className="text-sm text-gray-500">Each stage runs real AI analysis — live preview updates as it builds</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Build Pipeline - 2/3 width */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>What do you want to build?</CardTitle>
              <CardDescription>Describe your project and AI will analyze every aspect</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea value={state.prompt} onChange={e => updateState({ prompt: e.target.value })}
                placeholder="e.g. A task manager with drag-and-drop, due dates, and dark mode..."
                rows={4} className="w-full rounded-lg border border-gray-300 p-3 text-sm dark:border-gray-600 dark:bg-gray-800" />
              <Button onClick={startBuild} loading={state.running} className="w-full" disabled={state.running}>
                <Play className="h-4 w-4" /> {state.running ? 'Building...' : 'Start Real Build'}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-1">
            {STAGES.map((stage, i) => {
              const result = state.results.find(r => r.id === stage.id)
              const Icon = stage.icon
              const isActive = result?.status === 'running'
              const isDone = result?.status === 'completed'
              const isError = result?.status === 'error'
              const hasPreview = PREVIEW_STAGES.includes(stage.id) && state.previewHtml
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
                    <div className="flex items-center gap-2 flex-wrap">
                      <Icon className={`h-4 w-4 ${isActive ? 'text-blue-500' : isDone ? 'text-green-500' : 'text-gray-400'}`} />
                      <span className={`text-sm font-medium ${isActive ? 'text-blue-700 dark:text-blue-300' : isDone ? 'text-green-700 dark:text-green-300' : 'text-gray-600 dark:text-gray-400'}`}>
                        {stage.name}
                      </span>
                      {result?.duration && <span className="text-xs text-gray-400">{result.duration}</span>}
                      {hasPreview && <Badge variant="success" className="text-xs">Live Preview</Badge>}
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

          {state.fullOutput && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Complete Build Report</CardTitle>
                  <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(state.fullOutput)}>
                    <Copy className="h-3 w-3 mr-1" /> Copy
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-xs max-h-96 overflow-y-auto rounded bg-gray-50 p-4 dark:bg-gray-900">{state.fullOutput}</pre>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Live Preview - 1/3 width */}
        <div className="lg:col-span-1">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">Live Preview</CardTitle>
                  <CardDescription>Real-time generated app</CardDescription>
                </div>
                {state.previewHtml && (
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="secondary" onClick={() => navigator.clipboard.writeText(state.previewHtml)}>
                      <Copy className="h-3 w-3 mr-1" /> Code
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => {
                      const blob = new Blob([state.previewHtml], { type: 'text/html' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url; a.download = 'preview.html'; a.click()
                      URL.revokeObjectURL(url)
                    }}>
                      <FileText className="h-3 w-3 mr-1" /> Save
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 relative">
              {state.previewRunning && !state.previewHtml ? (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-500" />
                    <p className="mt-2 text-sm text-gray-500">Generating preview...</p>
                    <p className="text-xs text-gray-400">Updates after each stage</p>
                  </div>
                </div>
              ) : state.previewHtml ? (
                <div className="h-[500px] rounded-lg border border-gray-200 overflow-hidden dark:border-gray-700">
                  <iframe
                    srcDoc={state.previewHtml}
                    className="h-full w-full bg-white"
                    title="Live Preview"
                    sandbox="allow-scripts allow-same-origin allow-forms"
                  />
                </div>
              ) : (
                <div className="h-[500px] flex items-center justify-center text-gray-400">
                  <div className="text-center">
                    <Monitor className="mx-auto h-12 w-12 mb-2" />
                    <p className="text-sm">Run a build to see live preview</p>
                    <p className="text-xs mt-1">Updates after: Frontend, Backend, Integration, Test stages</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {state.builds.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Recent Builds</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {state.builds.map(b => (
              <div key={b.id} className="flex items-center justify-between rounded border border-gray-200 p-2 text-sm dark:border-gray-700">
                <span className="truncate">{b.prompt}</span>
                <span className="text-xs text-gray-400">{b.date}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}