interface ContextBlock {
  id: string
  type: 'system' | 'memory' | 'file' | 'tool' | 'history' | 'instruction'
  content: string
  priority: number
  size: number
  timestamp: string
}

interface ContextBudget {
  maxTokens: number
  systemReserve: number
  memoryReserve: number
  historyReserve: number
}

const DEFAULT_BUDGET: ContextBudget = {
  maxTokens: 32000,
  systemReserve: 4000,
  memoryReserve: 4000,
  historyReserve: 8000,
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

export function buildContext(
  blocks: ContextBlock[],
  budget: ContextBudget = DEFAULT_BUDGET
): { selected: ContextBlock[]; totalTokens: number; dropped: string[] } {
  const sorted = [...blocks].sort((a, b) => b.priority - a.priority)
  const selected: ContextBlock[] = []
  let totalTokens = 0
  const dropped: string[] = []

  for (const block of sorted) {
    const tokens = estimateTokens(block.content)
    let limit: number

    switch (block.type) {
      case 'system': limit = budget.systemReserve; break
      case 'memory': limit = budget.memoryReserve; break
      case 'history': limit = budget.historyReserve; break
      default: limit = budget.maxTokens - budget.systemReserve - budget.memoryReserve - budget.historyReserve
    }

    const currentTypeTokens = selected
      .filter(s => s.type === block.type)
      .reduce((sum, s) => sum + s.size, 0)

    if (currentTypeTokens + tokens <= limit && totalTokens + tokens <= budget.maxTokens) {
      selected.push(block)
      totalTokens += tokens
    } else {
      dropped.push(block.id)
    }
  }

  selected.sort((a, b) => {
    const order = ['system', 'instruction', 'file', 'memory', 'history', 'tool']
    return order.indexOf(a.type) - order.indexOf(b.type)
  })

  return { selected, totalTokens, dropped }
}

export function summarizeConversation(messages: { role: string; content: string }[]): string {
  if (messages.length <= 4) return ''

  const keep = messages.slice(-4)
  const older = messages.slice(0, -4)

  const summary = older
    .filter(m => m.role === 'user' || m.role === 'assistant')
    .map(m => `${m.role === 'user' ? 'Q' : 'A'}: ${m.content.slice(0, 200)}`)
    .join('\n')

  const summaryBlock = older.length > 0
    ? `[Earlier conversation summary (${older.length} messages):\n${summary}\n]`
    : ''

  const full = [...(summaryBlock ? [{ role: 'system', content: summaryBlock }] : []), ...keep]
  return full.map(m => `${m.role}: ${m.content}`).join('\n')
}

export function compressContext(
  messages: { role: string; content: string }[],
  maxTokens: number = 16000
): { role: string; content: string }[] {
  const total = estimateTokens(messages.map(m => m.content).join(''))
  if (total <= maxTokens) return messages

  const systemMessages = messages.filter(m => m.role === 'system')
  const nonSystem = messages.filter(m => m.role !== 'system')

  const summary = summarizeConversation(nonSystem)
  return [
    ...systemMessages,
    { role: 'system', content: summary },
  ]
}

export interface ContextReference {
  type: 'file' | 'function' | 'class' | 'variable' | 'tool' | 'memory'
  name: string
  content: string
  relevance: number
}

export function resolveReferences(
  references: ContextReference[],
  query: string
): ContextReference[] {
  const queryLower = query.toLowerCase()
  const queryTerms = queryLower.split(/\s+/).filter(t => t.length > 2)

  return references
    .map(ref => {
      let score = 0
      const nameLower = ref.name.toLowerCase()
      const contentLower = ref.content.toLowerCase()

      for (const term of queryTerms) {
        if (nameLower.includes(term)) score += 3
        if (contentLower.includes(term)) score += 1
      }

      return { ...ref, relevance: score }
    })
    .filter(ref => ref.relevance > 0)
    .sort((a, b) => b.relevance - a.relevance)
}

export type { ContextBlock, ContextBudget }
