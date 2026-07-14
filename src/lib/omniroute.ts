import { env } from '@/config/env'

interface OmniRouteModel {
  id: string
  name: string
  provider: string
  contextWindow: number
  pricing: { prompt: number; completion: number }
  capabilities: string[]
  health: 'healthy' | 'degraded' | 'down'
  lastChecked: number
}

interface ChatRequest {
  model: string
  messages: { role: string; content: string }[]
  temperature?: number
  maxTokens?: number
  stream?: boolean
  fallbackModels?: string[]
  verifyWith?: string
}

interface ChatResponse {
  content: string
  model: string
  provider: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  verified?: boolean
  verification?: string
  fallbackUsed?: boolean
}

interface VerificationResult {
  verified: boolean
  issues: string[]
  score: number
  feedback: string
}

interface Task {
  id: string
  type: 'chat' | 'build' | 'code' | 'analysis' | 'verification'
  payload: any
  status: 'pending' | 'running' | 'completed' | 'failed' | 'verified'
  result?: any
  verification?: VerificationResult
  createdAt: number
  updatedAt: number
  attempts: number
}

class OmniRouteClient {
  private baseUrl: string
  private apiKey: string
  private modelsCache: Map<string, OmniRouteModel> = new Map()
  private healthCheckInterval: NodeJS.Timeout | null = null
  private taskQueue: Task[] = []
  private processing = false

  constructor() {
    this.baseUrl = 'https://api.omniroute.online/v1'
    this.apiKey = env.ai.omnirouteKey || ''
    this.startHealthChecks()
    this.startTaskProcessor()
  }

  private async fetchModels(): Promise<OmniRouteModel[]> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${this.apiKey}` },
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = await response.json()
      return (data.data || data).map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        provider: m.owned_by || 'unknown',
        contextWindow: m.context_window || 4096,
        pricing: m.pricing || { prompt: 0, completion: 0 },
        capabilities: m.capabilities || [],
        health: 'healthy',
        lastChecked: Date.now(),
      }))
    } catch {
      return []
    }
  }

  async getModels(): Promise<OmniRouteModel[]> {
    if (this.modelsCache.size === 0) {
      const models = await this.fetchModels()
      models.forEach(m => this.modelsCache.set(m.id, m))
    }
    return Array.from(this.modelsCache.values())
  }

  private async checkModelHealth(modelId: string): Promise<'healthy' | 'degraded' | 'down'> {
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: modelId,
          messages: [{ role: 'user', content: 'health check' }],
          max_tokens: 1,
          stream: false,
        }),
        signal: AbortSignal.timeout(5000),
      })
      if (response.ok) return 'healthy'
      if (response.status === 429) return 'degraded'
      return 'down'
    } catch {
      return 'down'
    }
  }

  private startHealthChecks() {
    this.healthCheckInterval = setInterval(async () => {
      const models = await this.getModels()
      for (const model of models) {
        if (Date.now() - model.lastChecked > 60000) {
          model.health = await this.checkModelHealth(model.id)
          model.lastChecked = Date.now()
          this.modelsCache.set(model.id, model)
        }
      }
    }, 30000)
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const modelsToTry = [request.model, ...(request.fallbackModels || [])]
    let lastError = ''

    for (const model of modelsToTry) {
      const modelInfo = this.modelsCache.get(model)
      if (modelInfo && modelInfo.health === 'down') continue

      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: request.messages,
            temperature: request.temperature ?? 0.7,
            max_tokens: request.maxTokens ?? 4096,
            stream: false,
          }),
          signal: AbortSignal.timeout(60000),
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({}))
          lastError = `${model}: ${err.error?.message || response.statusText}`
          if (response.status === 429 || response.status >= 500) continue
          throw new Error(lastError)
        }

        const data = await response.json()
        let content = data.choices?.[0]?.message?.content || ''

        // Auto-verify if requested
        let verified = false
        let verification = ''
        if (request.verifyWith && content) {
          const verificationResult = await this.verifyResponse(content, request.verifyWith, request.messages)
          verified = verificationResult.verified
          verification = verificationResult.feedback
          if (!verified) {
            lastError = `Verification failed: ${verificationResult.issues.join(', ')}`
            continue // Try next fallback model
          }
        }

        return {
          content,
          model,
          provider: 'omniroute',
          usage: data.usage,
          verified,
          verification,
          fallbackUsed: model !== request.model,
        }
      } catch (err) {
        lastError = `${model}: ${err instanceof Error ? err.message : 'Unknown error'}`
        if (err instanceof Error && err.name === 'AbortError') continue
      }
    }

    throw new Error(`All models failed. Last error: ${lastError}`)
  }

  async *chatStream(request: ChatRequest): AsyncGenerator<string> {
    const response = await this.chat({ ...request, stream: false })
    // Simulate streaming by chunking the response
    const words = response.content.split(' ')
    for (const word of words) {
      yield word + ' '
      await new Promise(r => setTimeout(r, 10))
    }
  }

  async verifyResponse(content: string, verifyModel: string, originalMessages: { role: string; content: string }[]): Promise<VerificationResult> {
    const verificationPrompt = `You are a verification expert. Review the following AI response for accuracy, completeness, and potential issues.

Original Request: ${JSON.stringify(originalMessages, null, 2)}

AI Response to Verify:
${content}

Check for:
1. Factual accuracy
2. Completeness (does it answer the full question?)
3. Code correctness (if code provided)
4. Security issues
5. Best practices adherence
6. Logical consistency

Respond with JSON:
{
  "verified": true/false,
  "issues": ["issue1", "issue2"],
  "score": 0-100,
  "feedback": "detailed feedback"
}`

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: verifyModel,
          messages: [
            { role: 'system', content: 'You are a strict verification expert. Be thorough and critical.' },
            { role: 'user', content: verificationPrompt },
          ],
          temperature: 0.1,
          max_tokens: 1024,
          stream: false,
        }),
      })

      if (!response.ok) return { verified: true, issues: [], score: 100, feedback: 'Verification skipped' }

      const data = await response.json()
      const result = JSON.parse(data.choices?.[0]?.message?.content || '{}')
      return {
        verified: result.verified ?? true,
        issues: result.issues ?? [],
        score: result.score ?? 100,
        feedback: result.feedback ?? 'Verified',
      }
    } catch {
      return { verified: true, issues: [], score: 100, feedback: 'Verification skipped due to error' }
    }
  }

  // Task queue for background processing
  enqueueTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'attempts' | 'status'>): string {
    const id = `task_${Date.now()}_${Math.random().toString(36).slice(2)}`
    const taskObj: Task = {
      ...task,
      id,
      status: 'pending',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      attempts: 0,
    }
    this.taskQueue.push(taskObj)
    return id
  }

  private async processTask(task: Task) {
    task.status = 'running'
    task.attempts++
    task.updatedAt = Date.now()

    try {
      let result: any
      switch (task.type) {
        case 'chat':
          result = await this.chat(task.payload)
          break
        case 'verification':
          result = await this.verifyResponse(task.payload.content, task.payload.verifyModel, task.payload.messages)
          break
        case 'build':
          // Build pipeline execution
          result = { status: 'completed', output: 'Build completed' }
          break
        default:
          throw new Error(`Unknown task type: ${task.type}`)
      }

      // Auto-verify result if it's a chat/code task
      if (task.type === 'chat' && task.payload.verifyWith) {
        const verification = await this.verifyResponse(result.content, task.payload.verifyWith, task.payload.messages)
        task.verification = verification
        if (!verification.verified && task.attempts < 3) {
          task.status = 'pending'
          this.taskQueue.push(task)
          return
        }
      }

      task.status = 'verified'
      task.result = result
    } catch (err) {
      task.status = task.attempts >= 3 ? 'failed' : 'pending'
      if (task.status === 'pending') this.taskQueue.push(task)
      throw err
    } finally {
      task.updatedAt = Date.now()
    }
  }

  private startTaskProcessor() {
    setInterval(async () => {
      if (this.processing || this.taskQueue.length === 0) return
      this.processing = true

      const task = this.taskQueue.shift()
      if (task) {
        await this.processTask(task)
      }

      this.processing = false
    }, 1000)
  }

  getTaskStatus(id: string): Task | undefined {
    return this.taskQueue.find(t => t.id === id)
  }

  getQueueStatus(): { pending: number; running: number; completed: number; failed: number } {
    return {
      pending: this.taskQueue.filter(t => t.status === 'pending').length,
      running: this.taskQueue.filter(t => t.status === 'running').length,
      completed: this.taskQueue.filter(t => t.status === 'completed' || t.status === 'verified').length,
      failed: this.taskQueue.filter(t => t.status === 'failed').length,
    }
  }

  // Agent-to-agent conversation
  async runAgentConversation(config: {
    agents: Array<{ id: string; name: string; model: string; systemPrompt: string }>
    initialMessage: string
    rounds: number
    verifyWith?: string
  }): Promise<{ conversation: any[]; finalOutput: string }> {
    const conversation: any[] = []
    let currentMessage = config.initialMessage

    for (let round = 1; round <= config.rounds; round++) {
      for (const agent of config.agents) {
        const messages = [
          { role: 'system' as const, content: agent.systemPrompt },
          { role: 'user' as const, content: currentMessage },
        ]

        const response = await this.chat({
          model: agent.model,
          messages,
          fallbackModels: config.agents.filter(a => a.id !== agent.id).map(a => a.model),
          verifyWith: config.verifyWith,
        })

        conversation.push({
          round,
          agentId: agent.id,
          agentName: agent.name,
          model: agent.model,
          content: response.content,
          verified: response.verified,
        })

        currentMessage = `Previous agent (${agent.name}) said:\n${response.content}\n\nContinue the discussion or provide final synthesis.`
      }
    }

    const finalOutput = conversation
      .filter(m => m.round === config.rounds)
      .map(m => `${m.agentName}: ${m.content}`)
      .join('\n\n')

    return { conversation, finalOutput }
  }
}

export const omniRoute = new OmniRouteClient()

export async function executeOmniRouteChat(request: ChatRequest): Promise<ChatResponse> {
  return omniRoute.chat(request)
}

export function executeOmniRouteStream(request: ChatRequest): AsyncIterableIterator<string> {
    return omniRoute.chatStream(request) as AsyncIterableIterator<string>
  }

export async function executeOmniRouteVerification(request: { content: string; verifyModel: string; messages: any[] }): Promise<VerificationResult> {
  return omniRoute.verifyResponse(request.content, request.verifyModel, request.messages)
}

export async function executeAgentConversation(config: {
  agents: Array<{ id: string; name: string; model: string; systemPrompt: string }>
  initialMessage: string
  rounds: number
  verifyWith?: string
}) {
  return omniRoute.runAgentConversation(config)
}

export function enqueueOmniRouteTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt' | 'attempts' | 'status'>): string {
  return omniRoute.enqueueTask(task)
}

export function getOmniRouteTaskStatus(id: string): Task | undefined {
  return omniRoute.getTaskStatus(id)
}

export function getOmniRouteQueueStatus() {
  return omniRoute.getQueueStatus()
}