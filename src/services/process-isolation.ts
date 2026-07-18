type ProcessType = 'inference' | 'code-execution' | 'web-search' | 'file-operation'

interface IsolatedProcess {
  id: string
  type: ProcessType
  worker: Worker | null
  status: 'starting' | 'running' | 'idle' | 'crashed' | 'terminated'
  lastHeartbeat: number
  startTime: number
  taskCount: number
  errorCount: number
}

interface ProcessTask {
  id: string
  type: ProcessType
  payload: unknown
  priority: number
  createdAt: number
}

interface CrashEvent {
  processId: string
  type: ProcessType
  error: string
  lastKnownState: unknown
  timestamp: number
}

type IsolationCallback = (event: CrashEvent) => void

class ProcessIsolation {
  private processes: Map<string, IsolatedProcess> = new Map()
  private taskQueue: Map<ProcessType, ProcessTask[]> = new Map()
  private heartbeatTimers: Map<string, ReturnType<typeof setInterval>> = new Map()
  private listeners: Set<IsolationCallback> = new Set()
  private maxProcesses: number
  private heartbeatInterval: number
  private crashThreshold: number
  private initialized = false

  constructor(maxProcesses = 4, heartbeatInterval = 5000, crashThreshold = 15000) {
    this.maxProcesses = maxProcesses
    this.heartbeatInterval = heartbeatInterval
    this.crashThreshold = crashThreshold
  }

  async initialize(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    for (const type of ['inference', 'code-execution', 'web-search', 'file-operation'] as ProcessType[]) {
      this.taskQueue.set(type, [])
    }
  }

  async spawnProcess(type: ProcessType): Promise<IsolatedProcess> {
    await this.initialize()

    const runningCount = [...this.processes.values()].filter(p => p.status === 'running').length
    if (runningCount >= this.maxProcesses) {
      const idle = [...this.processes.values()].find(p => p.status === 'idle')
      if (idle) {
        this.terminateProcess(idle.id)
      } else {
        throw new Error(`Max processes (${this.maxProcesses}) reached. Terminate an idle process first.`)
      }
    }

    const processId = `proc_${type}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`

    let worker: Worker | null = null
    try {
      if (typeof Worker !== 'undefined') {
        const workerUrl = this.getWorkerUrl(type)
        worker = new Worker(workerUrl)
        worker.onerror = (ev) => {
          this.handleCrash(processId, type, ev.message || 'Worker error', null)
        }
      }
    } catch {
      worker = null
    }

    const process: IsolatedProcess = {
      id: processId, type, worker,
      status: 'running',
      lastHeartbeat: Date.now(),
      startTime: Date.now(),
      taskCount: 0,
      errorCount: 0,
    }

    if (worker) {
      worker.onmessage = (ev) => {
        if (ev.data.type === 'heartbeat') {
          process.lastHeartbeat = Date.now()
        } else if (ev.data.type === 'crash') {
          this.handleCrash(processId, type, ev.data.error || 'Unknown crash', ev.data.state || null)
        }
      }
    }

    this.processes.set(processId, process)

    const heartbeatTimer = setInterval(() => {
      const elapsed = Date.now() - process.lastHeartbeat
      if (elapsed > this.crashThreshold) {
        this.handleCrash(processId, type, `Heartbeat timeout: ${elapsed}ms since last ping`, null)
      }
    }, this.heartbeatInterval)
    this.heartbeatTimers.set(processId, heartbeatTimer)

    return process
  }

  async executeInProcess<T>(type: ProcessType, task: Omit<ProcessTask, 'id' | 'createdAt'>): Promise<T> {
    await this.initialize()

    const process = await this.getOrCreateProcess(type)
    const fullTask: ProcessTask = { ...task, id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, createdAt: Date.now() }

    if (process.worker) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          process.worker!.removeEventListener('message', handler)
          reject(new Error(`Task ${fullTask.id} timed out`))
        }, 60000)

        const handler = (ev: MessageEvent) => {
          if (ev.data.id === fullTask.id) {
            clearTimeout(timeout)
            process.worker!.removeEventListener('message', handler)
            if (ev.data.error) reject(new Error(ev.data.error))
            else resolve(ev.data.result as T)
          }
        }

        process.worker!.addEventListener('message', handler)
        process.worker!.postMessage({ ...fullTask })
        process.taskCount++
      })
    }

    const queue = this.taskQueue.get(type)!
    queue.push(fullTask)
    return new Promise((resolve, reject) => {
      const checkQueue = setInterval(() => {
        const idx = queue.findIndex(t => t.id === fullTask.id)
        if (idx >= 0) {
          const completed = queue.splice(idx, 1)[0] as ProcessTask & { result?: T; error?: string }
          clearInterval(checkQueue)
          if (completed.error) reject(new Error(completed.error))
          else resolve(completed.result as T)
        }
      }, 100)
      setTimeout(() => { clearInterval(checkQueue); reject(new Error(`Task ${fullTask.id} timed out in queue`)) }, 60000)
    })
  }

  async terminateProcess(processId: string): Promise<void> {
    const process = this.processes.get(processId)
    if (!process) return

    if (process.worker) {
      process.worker.terminate()
    }

    const timer = this.heartbeatTimers.get(processId)
    if (timer) {
      clearInterval(timer)
      this.heartbeatTimers.delete(processId)
    }

    process.status = 'terminated'
    this.processes.delete(processId)
  }

  async recoverProcess(processId: string): Promise<IsolatedProcess | null> {
    const crashed = this.processes.get(processId)
    if (!crashed || crashed.status !== 'crashed') return null

    this.terminateProcess(processId)
    return this.spawnProcess(crashed.type)
  }

  async shutdown(): Promise<void> {
    for (const [id] of this.processes) {
      await this.terminateProcess(id)
    }
    this.processes.clear()
    this.taskQueue.clear()
    this.initialized = false
  }

  async getOrCreateProcess(type: ProcessType): Promise<IsolatedProcess> {
    const existing = [...this.processes.values()].find(p => p.type === type && p.status === 'running')
    if (existing) return existing

    const idle = [...this.processes.values()].find(p => p.type === type && p.status === 'idle')
    if (idle) {
      idle.status = 'running'
      return idle
    }

    return this.spawnProcess(type)
  }

  sendHeartbeat(processId: string): void {
    const process = this.processes.get(processId)
    if (process) {
      process.lastHeartbeat = Date.now()
    }
  }

  markIdle(processId: string): void {
    const process = this.processes.get(processId)
    if (process && process.status === 'running') {
      process.status = 'idle'
    }
  }

  getProcessCount(type?: ProcessType): number {
    if (type) {
      return [...this.processes.values()].filter(p => p.type === type && (p.status === 'running' || p.status === 'idle')).length
    }
    return [...this.processes.values()].filter(p => p.status === 'running' || p.status === 'idle').length
  }

  getStatus(): { total: number; running: number; idle: number; crashed: number; queued: number } {
    const all = [...this.processes.values()]
    return {
      total: all.length,
      running: all.filter(p => p.status === 'running').length,
      idle: all.filter(p => p.status === 'idle').length,
      crashed: all.filter(p => p.status === 'crashed').length,
      queued: [...this.taskQueue.values()].reduce((sum, q) => sum + q.length, 0),
    }
  }

  onCrash(cb: IsolationCallback): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private handleCrash(processId: string, type: ProcessType, error: string, lastKnownState: unknown): void {
    const process = this.processes.get(processId)
    if (!process || process.status === 'crashed') return

    process.status = 'crashed'
    process.errorCount++

    const event: CrashEvent = { processId, type, error, lastKnownState, timestamp: Date.now() }
    for (const cb of this.listeners) cb(event)

    this.recoverProcess(processId)
  }

  private getWorkerUrl(type: ProcessType): string {
    switch (type) {
      case 'inference': return '/workers/inference.js'
      case 'code-execution': return '/workers/execution.js'
      case 'web-search': return '/workers/search.js'
      case 'file-operation': return '/workers/fileops.js'
      default: return '/workers/generic.js'
    }
  }
}

export const processIsolation = new ProcessIsolation()
