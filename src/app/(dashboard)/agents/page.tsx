'use client'
import { useState, useEffect } from 'react'
import { Plus, Play, Trash2, Bot } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Modal } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { getAgents, createAgent, deleteAgent, executeAgentPipeline, getAgentDefaults } from '@/services/agents'
import type { Agent, AgentRole } from '@/types'
import { formatDate } from '@/lib/utils'

const AGENT_ROLES: { value: AgentRole; label: string }[] = [
  { value: 'request-analyzer', label: 'Request Analyzer' },
  { value: 'requirement-planner', label: 'Requirement Planner' },
  { value: 'architecture-designer', label: 'Architecture Designer' },
  { value: 'research', label: 'Research Agent' },
  { value: 'code-generator', label: 'Code Generator' },
  { value: 'api-builder', label: 'API Builder' },
  { value: 'test-generator', label: 'Test Generator' },
  { value: 'security-reviewer', label: 'Security Reviewer' },
  { value: 'performance-optimizer', label: 'Performance Optimizer' },
  { value: 'final-reviewer', label: 'Final Reviewer' },
]

export default function AgentsPage() {
  const { user } = useAuth()
  const [agents, setAgents] = useState<Agent[]>([])
  const [showCreate, setShowCreate] = useState(false)
  const [selectedRole, setSelectedRole] = useState<AgentRole>('code-generator')
  const [request, setRequest] = useState('')
  const [running, setRunning] = useState(false)
  const [pipelineStatus, setPipelineStatus] = useState<string[]>([])

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    if (!user) return
    const data = await getAgents(user.id)
    setAgents(data)
  }

  async function handleCreate() {
    if (!user) return
    await createAgent(user.id, selectedRole)
    setShowCreate(false)
    load()
  }

  async function handleDelete(id: string) {
    await deleteAgent(id)
    load()
  }

  async function handleRunPipeline() {
    if (!user || !request.trim()) return
    setRunning(true)
    setPipelineStatus([])
    const result = await executeAgentPipeline(user.id, request, (agentName, status) => {
      setPipelineStatus(prev => [...prev, `${agentName}: ${status}`])
    })
    setRunning(false)
    if (!result.success && result.error) {
      setPipelineStatus(prev => [...prev, `Error: ${result.error}`])
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">AI Agents</h1>
          <p className="text-sm text-gray-500">Multi-agent system for complex tasks</p>
        </div>
        <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> Add Agent</Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {agents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Bot className="mx-auto h-8 w-8 text-gray-400" />
                <p className="mt-2 text-gray-500">No agents configured. Add agents to run the pipeline.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {agents.map(agent => (
                <Card key={agent.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <CardTitle>{agent.name}</CardTitle>
                      <Badge variant={agent.status === 'idle' ? 'default' : agent.status === 'running' ? 'info' : 'error'}>
                        {agent.status}
                      </Badge>
                    </div>
                    <CardDescription>{agent.role}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-xs text-gray-500">Model: {agent.model}</p>
                    <p className="text-xs text-gray-500">Tools: {agent.tools.join(', ')}</p>
                    <p className="text-xs text-gray-500">Created {formatDate(agent.created_at)}</p>
                    <Button size="sm" variant="danger" onClick={() => handleDelete(agent.id)}>
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <Card>
            <CardHeader>
              <CardTitle>Run Pipeline</CardTitle>
              <CardDescription>Execute all agents in sequence</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                value={request}
                onChange={e => setRequest(e.target.value)}
                placeholder="Describe what you want to build..."
                className="w-full rounded-lg border border-gray-300 p-3 text-sm dark:border-gray-600 dark:bg-gray-700"
                rows={6}
              />
              <Button onClick={handleRunPipeline} className="w-full" disabled={!request.trim() || running || agents.length === 0} loading={running}>
                <Play className="h-4 w-4" /> Run Pipeline
              </Button>
              {pipelineStatus.length > 0 && (
                <div className="space-y-1">
                  {pipelineStatus.map((s, i) => (
                    <p key={i} className="text-xs text-gray-600 dark:text-gray-400">{s}</p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Agent">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Agent Role</label>
            <select
              value={selectedRole}
              onChange={e => setSelectedRole(e.target.value as AgentRole)}
              className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm dark:border-gray-600 dark:bg-gray-700"
            >
              {AGENT_ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>
          {selectedRole && (
            <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600 dark:bg-gray-900 dark:text-gray-400">
              {getAgentDefaults(selectedRole).prompt}
            </div>
          )}
          <Button onClick={handleCreate} className="w-full">Add Agent</Button>
        </div>
      </Modal>
    </div>
  )
}
