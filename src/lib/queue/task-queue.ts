import { env } from '@/config/env'

export type TaskType = 'chat' | 'build' | 'search' | 'security' | 'verification' | 'aggregation' | 'code-generation' | 'analysis'

export interface Task {
  id: string
  type: TaskType
  payload: any
  priority: 'low' | 'normal' | 'high' | 'critical'
  status: 'pending' | 'running' | 'completed' | 'failed' | 'retrying'
  result?: any
  error?: string
  attempts: number
  maxAttempts: number
  createdAt: number
  updatedAt: number
  startedAt?: number
  completedAt?: number
  workerId?: string
}

export interface Worker {
  id: string
  type: 'main' | 'background' | 'security'
  status: 'idle' | 'running' | 'stopped' | 'error'
  currentTaskId?: string
  startedAt: number
  lastHeartbeat: number
  tasksCompleted: number
  tasksFailed: number
}

class TaskQueue {
  private tasks: Map<string, Task> = new Map()
  private workers: Map<string, Worker> = new Map()
  private processing = false
  private maxConcurrent = 3

  generateId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
  }

  enqueue(taskInput: Omit<Task, 'id' | 'status' | 'attempts' | 'createdAt' | 'updatedAt'>): string {
    const id = this.generateId()
    const task: Task = {
      ...taskInput,
      id,
      status: 'pending',
      attempts: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    this.tasks.set(id, task)
    this.processQueue()
    return id
  }

  getTask(id: string): Task | undefined {
    return this.tasks.get(id)
  }

  getTasksByStatus(status: Task['status']): Task[] {
    return Array.from(this.tasks.values()).filter(t => t.status === status)
  }

  getAllTasks(): Task[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt)
  }

  updateTask(id: string, updates: Partial<Task>): boolean {
    const task = this.tasks.get(id)
    if (!task) return false
    this.tasks.set(id, { ...task, ...updates, updatedAt: Date.now() })
    return true
  }

  registerWorker(workerInput: Omit<Worker, 'startedAt' | 'lastHeartbeat' | 'tasksCompleted' | 'tasksFailed'>): Worker {
    const worker: Worker = {
      ...workerInput,
      startedAt: Date.now(),
      lastHeartbeat: Date.now(),
      tasksCompleted: 0,
      tasksFailed: 0,
    }
    this.workers.set(worker.id, worker)
    return worker
  }

  unregisterWorker(id: string): boolean {
    return this.workers.delete(id)
  }

  getWorker(id: string): Worker | undefined {
    return this.workers.get(id)
  }

  getAllWorkers(): Worker[] {
    return Array.from(this.workers.values())
  }

  getAllWorkersArray(): Worker[] {
    return Array.from(this.workers.values())
  }

  async processQueue(): Promise<void> {
    if (this.processing) return
    this.processing = true

    while (true) {
      const pendingTasks = this.getTasksByStatus('pending')
        .filter(t => t.attempts < t.maxAttempts)
        .sort((a, b) => {
          const priorityOrder = { critical: 4, high: 3, normal: 2, low: 1 }
          return priorityOrder[b.priority] - priorityOrder[a.priority] || a.createdAt - b.createdAt
        })

      const availableWorkers = Array.from(this.workers.values())
        .filter(w => w.status === 'idle' || w.status === 'running')

      if (pendingTasks.length === 0 || availableWorkers.length === 0) {
        break
      }

      for (const task of pendingTasks.slice(0, this.maxConcurrent)) {
        const worker = availableWorkers.find(w => w.status === 'idle')
        if (!worker) break

        this.updateTask(task.id, { status: 'running', workerId: worker.id, startedAt: Date.now(), attempts: task.attempts + 1 })
        worker.status = 'running'
        worker.currentTaskId = task.id

        this.executeTask(task, worker).then(result => {
          if (result.error) {
            this.handleTaskFailure(task, worker, result.error)
          } else {
            this.handleTaskSuccess(task, worker, result)
          }
        })
      }

      await new Promise(r => setTimeout(r, 1000))
    }

    this.processing = false
  }

  private async executeTask(task: Task, worker: Worker): Promise<{ error?: string; result?: any }> {
    try {
      let result: any
      switch (task.type) {
        case 'chat':
          result = await this.executeChat(task.payload)
          break
        case 'build':
          result = await this.executeBuild(task.payload)
          break
        case 'search':
          result = await this.executeSearch(task.payload)
          break
        case 'security':
          result = await this.executeSecurityCheck(task.payload)
          break
        case 'verification':
          result = await this.executeVerification(task.payload)
          break
        case 'aggregation':
          result = await this.executeAggregation(task.payload)
          break
        case 'code-generation':
          result = await this.executeCodeGeneration(task.payload)
          break
        case 'analysis':
          result = await this.executeAnalysis(task.payload)
          break
        default:
          throw new Error(`Unknown task type: ${task.type}`)
      }
      return { result }
    } catch (err) {
      return { error: err instanceof Error ? err.message : 'Unknown error' }
    }
  }

  private async executeChat(payload: any): Promise<any> {
    const { executeParallel } = await import('@/lib/parallel-ai')
    return executeParallel({
      prompt: payload.prompt,
      systemPrompt: payload.systemPrompt,
      taskType: payload.taskType || 'general',
      models: [
        { provider: 'groq', model: 'llama-3.3-70b-versatile' },
        { provider: 'openrouter', model: 'openai/gpt-4o' },
        { provider: 'fireworks', model: 'accounts/fireworks/models/llama-v3p3-70b-instruct' },
      ],
    })
  }

  private async executeBuild(payload: any): Promise<any> {
    const { executeParallel } = await import('@/lib/parallel-ai')
    return executeParallel({
      prompt: payload.prompt,
      systemPrompt: 'Generate complete build pipeline with 10 stages',
      taskType: 'coding',
      models: [
        { provider: 'deepseek', model: 'deepseek-coder' },
        { provider: 'nvidia', model: 'nvidia/nemotron-3-ultra' },
        { provider: 'groq', model: 'llama-3.3-70b-versatile' },
      ],
    })
  }

  private async executeSearch(payload: any): Promise<any> {
    const { executeParallel } = await import('@/lib/parallel-ai')
    return executeParallel({
      prompt: payload.query,
      taskType: 'search',
      models: [
        { provider: 'tavily', model: 'tavily-search' },
        { provider: 'openrouter', model: 'google/gemini-pro' },
      ],
    })
  }

  private async executeSecurityCheck(payload: any): Promise<any> {
    const { executeParallel } = await import('@/lib/parallel-ai')
    return executeParallel({
      prompt: payload.url,
      taskType: 'security',
      models: [
        { provider: 'googleSafeBrowsing', model: 'url-check' },
        { provider: 'tavily', model: 'tavily-extract' },
      ],
    })
  }

  private async executeVerification(payload: any): Promise<any> {
    const { executeWithAggregation } = await import('@/lib/parallel-ai')
    return executeWithAggregation({
      prompt: payload.content,
      taskType: 'verification',
      models: [
        { provider: 'nvidia', model: 'nvidia/nemotron-3-ultra' },
        { provider: 'deepseek', model: 'deepseek-chat' },
        { provider: 'groq', model: 'llama-3.3-70b-versatile' },
      ],
    })
  }

  private async executeAggregation(payload: any): Promise<any> {
    const { executeWithAggregation } = await import('@/lib/parallel-ai')
    return executeWithAggregation(payload)
  }

  private async executeCodeGeneration(payload: any): Promise<any> {
    const { executeParallel } = await import('@/lib/parallel-ai')
    return executeParallel({
      prompt: payload.prompt,
      systemPrompt: 'Generate production-ready code with tests',
      taskType: 'coding',
      models: [
        { provider: 'deepseek', model: 'deepseek-coder' },
        { provider: 'nvidia', model: 'nvidia/nemotron-3-ultra' },
        { provider: 'groq', model: 'llama-3.3-70b-versatile' },
      ],
    })
  }

  private async executeAnalysis(payload: any): Promise<any> {
    const { executeParallel } = await import('@/lib/parallel-ai')
    return executeParallel({
      prompt: payload.prompt,
      systemPrompt: 'Provide comprehensive analysis with data-driven insights',
      taskType: 'analysis',
      models: [
        { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet' },
        { provider: 'mistral', model: 'mistral-large' },
        { provider: 'deepseek', model: 'deepseek-chat' },
      ],
    })
  }

  private async handleTaskSuccess(task: Task, worker: Worker, result: any): Promise<void> {
    this.updateTask(task.id, { status: 'completed', result, completedAt: Date.now() })
    worker.status = 'idle'
    worker.currentTaskId = undefined
    worker.tasksCompleted++
    worker.lastHeartbeat = Date.now()
  }

  private async handleTaskFailure(task: Task, worker: Worker, error: string): Promise<void> {
    if (task.attempts >= task.maxAttempts) {
      this.updateTask(task.id, { status: 'failed', error, completedAt: Date.now() })
      worker.tasksFailed++
    } else {
      this.updateTask(task.id, { status: 'pending', error, workerId: undefined, startedAt: undefined })
    }
    worker.status = 'idle'
    worker.currentTaskId = undefined
    worker.lastHeartbeat = Date.now()
    this.processQueue()
  }

  workerHeartbeat(workerId: string): boolean {
    const worker = this.workers.get(workerId)
    if (!worker) return false
    worker.lastHeartbeat = Date.now()
    return true
  }

  getStats(): { tasks: { pending: number; running: number; completed: number; failed: number }; workers: number } {
    const tasks = Array.from(this.tasks.values())
    return {
      tasks: {
        pending: tasks.filter(t => t.status === 'pending').length,
        running: tasks.filter(t => t.status === 'running').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        failed: tasks.filter(t => t.status === 'failed').length,
      },
      workers: this.workers.size,
    }
  }
}

export const taskQueue = new TaskQueue()

export const workers = {
  main: taskQueue.registerWorker({ id: 'worker-main', type: 'main', status: 'idle' }),
  background: taskQueue.registerWorker({ id: 'worker-background', type: 'background', status: 'idle' }),
  security: taskQueue.registerWorker({ id: 'worker-security', type: 'security', status: 'idle' }),
}

if (typeof window === 'undefined') {
  setInterval(() => taskQueue.processQueue(), 5000)
  setInterval(() => {
    const now = Date.now()
    for (const worker of taskQueue.getAllWorkersArray()) {
      if (now - worker.lastHeartbeat > 60000 && worker.status !== 'stopped') {
        taskQueue.unregisterWorker(worker.id)
      }
    }
  }, 30000)
}