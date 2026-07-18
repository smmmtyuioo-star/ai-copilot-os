interface SchedulerEntry {
  provider: string
  model: string
  lastAccessed: number
  accessCount: number
  totalLatency: number
  failureCount: number
  ttl: number
  warm: boolean
}

interface SchedulerConfig {
  defaultTtl: number
  warmTtl: number
  maxEntries: number
  evictionBatch: number
}

const DEFAULT_CONFIG: SchedulerConfig = {
  defaultTtl: 30_000,
  warmTtl: 120_000,
  maxEntries: 50,
  evictionBatch: 10,
}

class ModelScheduler {
  private entries: Map<string, SchedulerEntry> = new Map()
  private config: SchedulerConfig
  private evictionTimer: ReturnType<typeof setInterval> | null = null
  private listener: ((event: { type: string; provider: string; model: string; latency: number }) => void) | null = null

  constructor(config: Partial<SchedulerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.startEvictionCycle()
  }

  private key(provider: string, model: string): string {
    return `${provider}::${model}`
  }

  private startEvictionCycle(): void {
    if (typeof window === 'undefined') return
    this.evictionTimer = setInterval(() => this.evict(), 15_000)
  }

  private evict(): void {
    const now = Date.now()
    const cold: { key: string; entry: SchedulerEntry }[] = []

    for (const [key, entry] of this.entries) {
      entry.warm = (now - entry.lastAccessed) < (entry.ttl || this.config.defaultTtl)
      if (!entry.warm) {
        cold.push({ key, entry })
      }
    }

    cold.sort((a, b) => a.entry.lastAccessed - b.entry.lastAccessed)
    const toRemove = cold.slice(0, this.config.evictionBatch)
    for (const { key } of toRemove) {
      this.entries.delete(key)
    }

    if (toRemove.length > 0 && this.entries.size > this.config.maxEntries) {
      const remaining = [...this.entries.entries()]
        .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed)
      const overflow = remaining.slice(0, this.entries.size - this.config.maxEntries)
      for (const [key] of overflow) {
        this.entries.delete(key)
      }
    }
  }

  access(provider: string, model: string): boolean {
    const k = this.key(provider, model)
    const entry = this.entries.get(k)
    if (!entry) {
      this.entries.set(k, {
        provider, model,
        lastAccessed: Date.now(),
        accessCount: 1,
        totalLatency: 0,
        failureCount: 0,
        ttl: this.config.defaultTtl,
        warm: false,
      })
      return false
    }
    entry.lastAccessed = Date.now()
    entry.accessCount++
    entry.warm = true
    entry.ttl = this.config.warmTtl
    return true
  }

  recordLatency(provider: string, model: string, latency: number): void {
    const k = this.key(provider, model)
    const entry = this.entries.get(k)
    if (entry) {
      entry.totalLatency += latency
    }
    this.listener?.({ type: 'latency', provider, model, latency })
  }

  recordFailure(provider: string, model: string): void {
    const k = this.key(provider, model)
    const entry = this.entries.get(k)
    if (entry) {
      entry.failureCount++
      entry.warm = false
    }
  }

  keepWarm(provider: string, model: string, ttl?: number): void {
    const k = this.key(provider, model)
    const existing = this.entries.get(k)
    this.entries.set(k, {
      provider, model,
      lastAccessed: Date.now(),
      accessCount: existing?.accessCount || 0,
      totalLatency: existing?.totalLatency || 0,
      failureCount: existing?.failureCount || 0,
      ttl: ttl ?? this.config.warmTtl,
      warm: true,
    })
  }

  isWarm(provider: string, model: string): boolean {
    const entry = this.entries.get(this.key(provider, model))
    return entry?.warm ?? false
  }

  getStatus(provider: string, model: string): { warm: boolean; stats: { accessCount: number; avgLatency: number; failureRate: number } } | null {
    const entry = this.entries.get(this.key(provider, model))
    if (!entry) return null
    return {
      warm: entry.warm,
      stats: {
        accessCount: entry.accessCount,
        avgLatency: entry.accessCount > 0 ? entry.totalLatency / entry.accessCount : 0,
        failureRate: entry.accessCount > 0 ? entry.failureCount / entry.accessCount : 0,
      },
    }
  }

  getWarmModels(): { provider: string; model: string; avgLatency: number }[] {
    const result: { provider: string; model: string; avgLatency: number }[] = []
    for (const [, entry] of this.entries) {
      if (entry.warm) {
        result.push({
          provider: entry.provider,
          model: entry.model,
          avgLatency: entry.accessCount > 0 ? entry.totalLatency / entry.accessCount : 0,
        })
      }
    }
    return result
  }

  getColdModels(): { provider: string; model: string }[] {
    const result: { provider: string; model: string }[] = []
    for (const [, entry] of this.entries) {
      if (!entry.warm) {
        result.push({ provider: entry.provider, model: entry.model })
      }
    }
    return result
  }

  getAllEntries(): Map<string, SchedulerEntry> {
    return new Map(this.entries)
  }

  onEvent(cb: (event: { type: string; provider: string; model: string; latency: number }) => void): void {
    this.listener = cb
  }

  clear(): void {
    this.entries.clear()
  }

  destroy(): void {
    if (this.evictionTimer) {
      clearInterval(this.evictionTimer)
      this.evictionTimer = null
    }
    this.entries.clear()
    this.listener = null
  }
}

export const modelScheduler = new ModelScheduler()
