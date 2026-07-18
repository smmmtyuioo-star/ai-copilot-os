import { skillRegistry } from './skill-registry'
import { generateId } from '@/lib/utils'

interface OrchestratorNode {
  id: string
  agentId: string
  agentName: string
  role: string
  prompt: string
  dependsOn: string[]
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped'
  output?: string
  error?: string
  startedAt?: string
  completedAt?: string
  latency?: number
}

interface OrchestrationPipeline {
  id: string
  name: string
  userId: string
  request: string
  nodes: OrchestratorNode[]
  status: 'pending' | 'running' | 'completed' | 'failed'
  createdAt: string
  updatedAt: string
  parallelSessions: boolean
  aggregatorOutput?: string
  generateSkills: boolean
}

interface PipelineStatusCallback {
  (nodeId: string, status: string, output?: string, error?: string): void
}

const DEFAULT_PARALLEL_PIPELINE = [
  { role: 'research', prompt: 'Research the domain, technologies, and patterns relevant to this request. Provide findings with specific references.' },
  { role: 'architecture-designer', prompt: 'Design the architecture. Identify components, data flow, and technical decisions needed.' },
  { role: 'security-reviewer', prompt: 'Review for security considerations. Identify vulnerabilities, auth requirements, and data protection needs.' },
]

const DEPENDENT_PIPELINE = [
  { role: 'request-analyzer', prompt: 'Analyze the request and extract detailed requirements, constraints, and success criteria.', dependsOn: [] },
  { role: 'architecture-designer', prompt: 'Design architecture based on requirements analysis.', dependsOn: ['request-analyzer'] },
  { role: 'code-generator', prompt: 'Generate implementation code following the architecture design.', dependsOn: ['architecture-designer'] },
  { role: 'test-generator', prompt: 'Write tests for the generated code.', dependsOn: ['code-generator'] },
  { role: 'final-reviewer', prompt: 'Review all outputs against requirements and quality standards.', dependsOn: ['test-generator'] },
]

class Orchestrator {
  private pipelines: Map<string, OrchestrationPipeline> = new Map()
  private activeNodes: Map<string, AbortController> = new Map()
  private listeners: Set<(pipeline: OrchestrationPipeline) => void> = new Set()

  async createPipeline(
    userId: string,
    request: string,
    options: {
      name?: string
      nodes?: { role: string; prompt: string; dependsOn?: string[] }[]
      parallelSessions?: boolean
      generateSkills?: boolean
    } = {}
  ): Promise<OrchestrationPipeline> {
    const pipeId = generateId()
    const stages = options.nodes || DEPENDENT_PIPELINE

    const nodes: OrchestratorNode[] = stages.map((s, i) => ({
      id: `${pipeId}_${s.role}_${i}`,
      agentId: '',
      agentName: s.role.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      role: s.role,
      prompt: s.prompt,
      dependsOn: s.dependsOn || [],
      status: 'pending' as const,
    }))

    const pipeline: OrchestrationPipeline = {
      id: pipeId,
      name: options.name || `Pipeline ${new Date().toLocaleTimeString()}`,
      userId,
      request,
      nodes,
      status: 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      parallelSessions: options.parallelSessions ?? true,
      generateSkills: options.generateSkills ?? true,
    }

    this.pipelines.set(pipeId, pipeline)
    this.notify(pipeline)
    return pipeline
  }

  async executePipeline(
    pipeId: string,
    onStatus?: PipelineStatusCallback
  ): Promise<OrchestrationPipeline> {
    const pipeline = this.pipelines.get(pipeId)
    if (!pipeline) throw new Error(`Pipeline ${pipeId} not found`)

    pipeline.status = 'running'
    pipeline.updatedAt = new Date().toISOString()
    this.notify(pipeline)

    try {
      const sorted = this.topologicalSort(pipeline.nodes)
      const executionMap = new Map<string, Promise<void>>()
      const results = new Map<string, string>()

      for (const node of sorted) {
        const deps = node.dependsOn.map(depRole =>
          sorted.find(n => n.role === depRole)
        ).filter(Boolean)

        if (pipeline.parallelSessions && node.dependsOn.length === 0) {
          executionMap.set(node.id, this.executeNode(pipeline, node, results, onStatus))
        } else {
          await Promise.all(
            node.dependsOn
              .map(depRole => sorted.find(n => n.role === depRole)?.id)
              .filter(Boolean)
              .map(id => executionMap.get(id!))
          )
          executionMap.set(node.id, this.executeNode(pipeline, node, results, onStatus))
        }
      }

      await Promise.all([...executionMap.values()])

      const failed = pipeline.nodes.filter(n => n.status === 'failed')
      if (failed.length > 0) {
        pipeline.status = failed.length === pipeline.nodes.length ? 'failed' : 'completed'
      } else {
        pipeline.status = 'completed'
      }

      if (pipeline.generateSkills && pipeline.status === 'completed') {
        await this.autoGenerateSkills(pipeline)
      }

      if (pipeline.parallelSessions && pipeline.nodes.length > 1) {
        await this.aggregateResults(pipeline)
      }
    } catch (err) {
      pipeline.status = 'failed'
      const errorMessage = err instanceof Error ? err.message : 'Pipeline execution failed'
      onStatus?.('pipeline', 'failed', undefined, errorMessage)
    }

    pipeline.updatedAt = new Date().toISOString()
    this.notify(pipeline)
    return pipeline
  }

  private async executeNode(
    pipeline: OrchestrationPipeline,
    node: OrchestratorNode,
    results: Map<string, string>,
    onStatus?: PipelineStatusCallback
  ): Promise<void> {
    node.status = 'running'
    node.startedAt = new Date().toISOString()
    onStatus?.(node.id, 'running')
    this.notify(pipeline)

    const controller = new AbortController()
    this.activeNodes.set(node.id, controller)

    const startTime = Date.now()
    try {
      const context = node.dependsOn
        .map(depRole => {
          const depNode = pipeline.nodes.find(n => n.role === depRole)
          const depResult = results.get(depRole)
          return depResult ? `## ${depNode?.agentName} Output\n${depResult}` : null
        })
        .filter(Boolean)
        .join('\n\n')

      const fullPrompt = context
        ? `${node.prompt}\n\nContext from upstream agents:\n${context}\n\nOriginal request: ${pipeline.request}`
        : `${node.prompt}\n\nOriginal request: ${pipeline.request}`

      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: `You are a ${node.agentName} agent in a multi-agent pipeline. ${node.prompt}\n\n${node.dependsOn.length > 0 ? 'Use the context from upstream agents to inform your response.' : 'Work independently on this task.'}\n\nBe thorough and concrete. Produce actionable output.` },
            { role: 'user', content: fullPrompt },
          ],
        }),
        signal: controller.signal,
      })

      if (!response.ok) {
        throw new Error(`Agent ${node.agentName} returned ${response.status}`)
      }

      const data = await response.json()
      const output = data.output || data.choices?.[0]?.message?.content || ''

      node.output = output
      node.status = 'completed'
      node.latency = Date.now() - startTime
      node.completedAt = new Date().toISOString()
      results.set(node.role, output)
      onStatus?.(node.id, 'completed', output)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      node.status = 'failed'
      node.error = message
      node.latency = Date.now() - startTime
      node.completedAt = new Date().toISOString()
      onStatus?.(node.id, 'failed', undefined, message)

      for (const dep of pipeline.nodes.filter(n => n.dependsOn.includes(node.role))) {
        dep.status = 'skipped'
        dep.error = `Dependency ${node.agentName} failed`
        onStatus?.(dep.id, 'skipped', undefined, dep.error)
      }
    } finally {
      this.activeNodes.delete(node.id)
      this.notify(pipeline)
    }
  }

  private async aggregateResults(pipeline: OrchestrationPipeline): Promise<void> {
    const completed = pipeline.nodes.filter(n => n.status === 'completed' && n.output)
    if (completed.length < 2) return

    const aggregationInput = completed
      .map(n => `## ${n.agentName}\n${n.output}`)
      .join('\n\n---\n\n')

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: 'You are a synthesis expert. Combine multiple agent outputs into one coherent, comprehensive answer. Remove redundancy, resolve conflicts, and structure the result clearly.' },
            { role: 'user', content: `Synthesize these agent outputs into a single superior answer:\n\n${aggregationInput}` },
          ],
        }),
      })

      if (response.ok) {
        const data = await response.json()
        pipeline.aggregatorOutput = data.output || data.choices?.[0]?.message?.content || ''
      }
    } catch {
      // aggregation is best-effort
    }
  }

  private async autoGenerateSkills(pipeline: OrchestrationPipeline): Promise<void> {
    const completed = pipeline.nodes.filter(n => n.status === 'completed' && n.output)
    for (const node of completed) {
      try {
        skillRegistry.register({
          taskDescription: `${node.agentName}: ${node.prompt}`,
          taskOutput: node.output || '',
          sourceTaskId: pipeline.id,
          suggestedName: node.agentName,
        })
      } catch {
        // best-effort
      }
    }
  }

  private topologicalSort(nodes: OrchestratorNode[]): OrchestratorNode[] {
    const visited = new Set<string>()
    const sorted: OrchestratorNode[] = []
    const nodeMap = new Map(nodes.map(n => [n.role, n]))

    function visit(node: OrchestratorNode): void {
      if (visited.has(node.id)) return
      visited.add(node.id)
      for (const dep of node.dependsOn) {
        const depNode = nodeMap.get(dep)
        if (depNode) visit(depNode)
      }
      sorted.push(node)
    }

    for (const node of nodes) {
      if (!visited.has(node.id)) visit(node)
    }

    return sorted
  }

  cancelNode(nodeId: string): void {
    const controller = this.activeNodes.get(nodeId)
    if (controller) {
      controller.abort()
      this.activeNodes.delete(nodeId)
    }
  }

  cancelPipeline(pipeId: string): void {
    const pipeline = this.pipelines.get(pipeId)
    if (!pipeline) return
    for (const node of pipeline.nodes) {
      this.cancelNode(node.id)
    }
    pipeline.status = 'failed'
    this.notify(pipeline)
  }

  getPipeline(pipeId: string): OrchestrationPipeline | undefined {
    return this.pipelines.get(pipeId)
  }

  listPipelines(userId?: string): OrchestrationPipeline[] {
    const all = [...this.pipelines.values()]
    return userId ? all.filter(p => p.userId === userId) : all
  }

  deletePipeline(pipeId: string): boolean {
    this.cancelPipeline(pipeId)
    return this.pipelines.delete(pipeId)
  }

  onChange(cb: (pipeline: OrchestrationPipeline) => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private notify(pipeline: OrchestrationPipeline): void {
    for (const cb of this.listeners) cb(pipeline)
  }
}

export const orchestrator = new Orchestrator()
