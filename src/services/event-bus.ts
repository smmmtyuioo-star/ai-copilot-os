type EventHandler = (payload: any) => void | Promise<void>

interface EventSubscription {
  event: string
  handler: EventHandler
  once?: boolean
}

const subscriptions: EventSubscription[] = []
let idCounter = 0

export function on(event: string, handler: EventHandler): () => void {
  const sub: EventSubscription = { event, handler }
  subscriptions.push(sub)
  return () => {
    const idx = subscriptions.indexOf(sub)
    if (idx >= 0) subscriptions.splice(idx, 1)
  }
}

export function once(event: string, handler: EventHandler): () => void {
  const sub: EventSubscription = { event, handler, once: true }
  subscriptions.push(sub)
  return () => {
    const idx = subscriptions.indexOf(sub)
    if (idx >= 0) subscriptions.splice(idx, 1)
  }
}

export async function emit(event: string, payload?: any): Promise<void> {
  const toProcess = subscriptions.filter(s => s.event === event || s.event === '*')
  await Promise.all(
    toProcess.map(async sub => {
      try {
        await sub.handler(payload)
      } catch (err) {
        console.error(`[event-bus] Error in handler for "${event}":`, err)
      }
      if (sub.once) {
        const idx = subscriptions.indexOf(sub)
        if (idx >= 0) subscriptions.splice(idx, 1)
      }
    })
  )
}

export function clear(): void {
  subscriptions.length = 0
}

export function count(): number {
  return subscriptions.length
}

export const Events = {
  MESSAGE_SENT: 'message:sent',
  MESSAGE_RECEIVED: 'message:received',
  SESSION_CREATED: 'session:created',
  SESSION_UPDATED: 'session:updated',
  TOOL_CALLED: 'tool:called',
  TOOL_RESULT: 'tool:result',
  MEMORY_SAVED: 'memory:saved',
  MEMORY_RECALLED: 'memory:recalled',
  SKILL_CREATED: 'skill:created',
  SKILL_IMPROVED: 'skill:improved',
  AGENT_STARTED: 'agent:started',
  AGENT_FINISHED: 'agent:finished',
  AGENT_ERROR: 'agent:error',
  PLUGIN_ENABLED: 'plugin:enabled',
  PLUGIN_DISABLED: 'plugin:disabled',
  PROVIDER_SWITCHED: 'provider:switched',
  MODEL_CHANGED: 'model:changed',
  ERROR: 'error',
} as const
