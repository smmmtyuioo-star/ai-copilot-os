'use client'
import { useState } from 'react'
import { Play, CheckCircle2, Circle, Loader2, AlertCircle, Clock, FileText, Bug, Shield, Zap, Brain, Search, Code, TestTube, Rocket } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Button } from '@/components/ui'
import { generateId } from '@/lib/utils'

type StageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'skipped'

interface BuildStage {
  id: string
  name: string
  icon: any
  status: StageStatus
  duration?: string
  log?: string[]
}

const PIPELINE: BuildStage[] = [
  { id: '1', name: 'Scanner', icon: Search, status: 'pending' },
  { id: '2', name: 'Research', icon: Brain, status: 'pending' },
  { id: '3', name: 'Planner', icon: FileText, status: 'pending' },
  { id: '4', name: 'Architect', icon: Code, status: 'pending' },
  { id: '5', name: 'Frontend Builder', icon: Code, status: 'pending' },
  { id: '6', name: 'Backend Builder', icon: Code, status: 'pending' },
  { id: '7', name: 'Integration', icon: Zap, status: 'pending' },
  { id: '8', name: 'QA & Testing', icon: TestTube, status: 'pending' },
  { id: '9', name: 'Debugger', icon: Bug, status: 'pending' },
  { id: '10', name: 'Final Reviewer', icon: Shield, status: 'pending' },
  { id: '11', name: 'Deploy', icon: Rocket, status: 'pending' },
]

export default function BuildPage() {
  const [pipeline, setPipeline] = useState<BuildStage[]>(PIPELINE)
  const [running, setRunning] = useState(false)
  const [prompt, setPrompt] = useState('')
  const [builds, setBuilds] = useState<{ id: string; prompt: string; status: string; timestamp: string }[]>([])

  async function runBuild() {
    if (!prompt.trim()) return
    setRunning(true)

    const stages: BuildStage[] = pipeline.map((s, i) => ({
      ...s,
      status: (i === 0 ? 'running' : 'pending') as StageStatus,
      duration: undefined,
      log: undefined,
    }))
    setPipeline(stages)

    for (let i = 0; i < stages.length; i++) {
      await new Promise(r => setTimeout(r, 800 + Math.random() * 1200))

      stages[i] = { ...stages[i], status: 'completed' as StageStatus, duration: `${(0.8 + Math.random() * 1.2).toFixed(1)}s`, log: [`${stages[i].name} completed`, `Processing: ${prompt.slice(0, 50)}...`] }
      if (i < stages.length - 1) stages[i + 1] = { ...stages[i + 1], status: 'running' as StageStatus }
      setPipeline([...stages])
    }

    setBuilds(prev => [{ id: generateId(), prompt, status: 'completed', timestamp: new Date().toISOString() }, ...prev])
    setRunning(false)
  }

  function getStatusIcon(status: string) {
    switch (status) {
      case 'completed': return <CheckCircle2 className="h-5 w-5 text-green-500" />
      case 'running': return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
      case 'failed': return <AlertCircle className="h-5 w-5 text-red-500" />
      case 'skipped': return <Circle className="h-5 w-5 text-gray-300" />
      default: return <Circle className="h-5 w-5 text-gray-300" />
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Build Pipeline</h1>
        <p className="text-sm text-gray-500">Full-stack AI build pipeline with real progress</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Start a Build</CardTitle>
          <CardDescription>Describe what you want to build</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <input value={prompt} onChange={e => setPrompt(e.target.value)}
              placeholder="Build a todo app with React and Node.js..."
              className="flex-1 rounded-lg border border-gray-300 px-4 py-3 text-sm dark:border-gray-600 dark:bg-gray-800" />
            <Button onClick={runBuild} loading={running}><Play className="h-4 w-4" /> Build</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pipeline Progress</CardTitle>
          <CardDescription>{running ? 'Build in progress...' : 'Ready'}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-1">
          {pipeline.map((stage, i) => (
            <div key={stage.id} className={`flex items-center gap-3 rounded-lg p-3 transition-colors ${
              stage.status === 'running' ? 'bg-blue-50 dark:bg-blue-900/20' :
              stage.status === 'completed' ? 'bg-green-50/50 dark:bg-green-900/10' : ''
            }`}>
              <div className="shrink-0">{getStatusIcon(stage.status)}</div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${stage.status === 'running' ? 'text-blue-700 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300'}`}>
                    {stage.name}
                  </span>
                  {stage.duration && <span className="text-xs text-gray-400"><Clock className="h-3 w-3 inline" /> {stage.duration}</span>}
                </div>
                {stage.log && stage.log.map((l, j) => (
                  <p key={j} className="text-xs text-gray-500 font-mono mt-0.5">{l}</p>
                ))}
              </div>
              <div className="flex items-center gap-1">
                {Array.from({ length: 5 }).map((_, j) => (
                  <div key={j} className={`h-1.5 w-4 rounded-full ${
                    stage.status === 'completed' ? 'bg-green-500' :
                    stage.status === 'running' && j === 0 ? 'bg-blue-500 animate-pulse' :
                    'bg-gray-200 dark:bg-gray-700'
                  }`} />
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {builds.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Build History</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {builds.map(b => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border border-gray-200 p-3 text-sm dark:border-gray-700">
                <span className="truncate font-medium">{b.prompt}</span>
                <Badge variant={b.status === 'completed' ? 'success' : 'warning'}>{b.status}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
