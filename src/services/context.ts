import { searchMemories } from '@/services/memory'

function estimateTokens(text: string): number {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

function truncateText(content: string, maxTokens: number): string {
  if (estimateTokens(content) <= maxTokens) return content
  const maxChars = maxTokens * 4
  return content.slice(0, maxChars) + `\n\n... [truncated: ${estimateTokens(content)} → ${maxTokens} tokens]`
}

export interface ContextConfig {
  systemPrompt?: string
  maxTokens?: number
  memoryQuery?: string
  userId?: string
  maxMemories?: number
  keepLastMessages?: number
  maxToolResultTokens?: number
  staleHours?: number
  toolSchemas?: any[]
}

export interface PreparedMessage {
  role: string
  content: string
  name?: string
  tool_call_id?: string
  tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[]
}

export interface ContextResult {
  messages: PreparedMessage[]
  totalTokens: number
  systemTokens: number
  historyTokens: number
  memoryTokens: number
  toolSchemaTokens: number
  injectedMemories: number
  truncatedToolOutputs: number
  removedMessages: number
}

type ScoredMessage = {
  msg: PreparedMessage
  tokens: number
  score: number
  index: number
}

function scoreMessage(msg: PreparedMessage, index: number, total: number): number {
  let score = 0

  score += (index / total) * 50

  if (msg.role === 'user') score += 20
  if (msg.role === 'assistant' && msg.tool_calls) score += 15
  if (msg.role === 'assistant' && !msg.tool_calls) score += 25
  if (msg.role === 'tool') score += 5

  if (msg.content && msg.content.length > 500) score -= 10

  return score
}

function findReferencedToolCalls(messages: PreparedMessage[]): Set<string> {
  const referenced = new Set<string>()
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === 'assistant' && messages[i].tool_calls) {
      for (const tc of messages[i].tool_calls || []) {
        referenced.add(tc.id)
      }
    }
    if (messages[i].role === 'tool' && messages[i].tool_call_id) {
      if (!referenced.has(messages[i].tool_call_id!)) {
        for (let j = i + 1; j < messages.length; j++) {
          const later = messages[j].content?.toLowerCase() || ''
          const earlierTool = messages[i].content?.toLowerCase().slice(0, 100) || ''
          if (later.includes(earlierTool.slice(0, 30))) {
            referenced.add(messages[i].tool_call_id!)
          }
        }
      }
    }
  }
  return referenced
}

export async function prepareContext(
  messages: PreparedMessage[],
  config: ContextConfig = {}
): Promise<ContextResult> {
  const {
    systemPrompt,
    maxTokens = 32000,
    memoryQuery,
    userId,
    maxMemories = 5,
    maxToolResultTokens = 500,
    staleHours = 24,
  } = config

  let keepLastMessages = config.keepLastMessages ?? 3
  const systemTokens = systemPrompt ? estimateTokens(systemPrompt) + 8 : 0
  const toolSchemaTokens = config.toolSchemas ? estimateTokens(JSON.stringify(config.toolSchemas)) + 16 : 0
  const result: ContextResult = {
    messages: [],
    totalTokens: 0,
    systemTokens,
    historyTokens: 0,
    memoryTokens: 0,
    toolSchemaTokens,
    injectedMemories: 0,
    truncatedToolOutputs: 0,
    removedMessages: 0,
  }

  let remainingBudget = maxTokens - systemTokens - toolSchemaTokens - 512
  const referencedToolCallIds = findReferencedToolCalls(messages)

  let memoryContext = ''
  if (memoryQuery && userId) {
    try {
      const memories = searchMemories(userId, memoryQuery)
      const relevant = memories.slice(0, maxMemories)
      if (relevant.length > 0) {
        memoryContext = 'Relevant context from past conversations:\n' +
          relevant.map(m => `- ${m.content}`).join('\n')
        result.injectedMemories = relevant.length
      }
    } catch (e) { console.error('Context memory search failed:', e) }
  }

  const memoryTokens = memoryContext ? estimateTokens(memoryContext) : 0
  remainingBudget -= memoryTokens
  result.memoryTokens = memoryTokens

  if (memoryContext && remainingBudget > 0) {
    result.messages.push({ role: 'system', content: memoryContext })
  }

  const total = messages.length
  const scored: ScoredMessage[] = messages.map((msg, i) => {
    let content = msg.content || ''

    if (msg.role === 'tool' && msg.tool_call_id) {
      const isReferenced = referencedToolCallIds.has(msg.tool_call_id)
      const truncateBudget = isReferenced ? maxToolResultTokens : Math.floor(maxToolResultTokens / 2)
      const truncated = truncateText(content, truncateBudget)
      if (truncated !== content) result.truncatedToolOutputs++
      content = truncated
    }

    const overhead = msg.role === 'tool' ? 4 : msg.role === 'assistant' && msg.tool_calls ? 8 : 4
    const tokens = estimateTokens(content) + overhead
    const score = scoreMessage({ ...msg, content }, i, total)

    return { msg: { ...msg, content }, tokens, score, index: i }
  })

  scored.sort((a, b) => b.score - a.score)

  const keepIndices = new Set<number>()
  for (let i = total - 1; i >= Math.max(0, total - keepLastMessages); i--) {
    keepIndices.add(i)
  }

  let budget = remainingBudget
  const selected: ScoredMessage[] = []

  for (const sm of scored) {
    if (keepIndices.has(sm.index) || sm.tokens <= budget) {
      if (!keepIndices.has(sm.index)) budget -= sm.tokens
      selected.push(sm)
    } else {
      result.removedMessages++
    }
  }

  selected.sort((a, b) => a.index - b.index)
  const selectedTokens = selected.reduce((sum, s) => sum + s.tokens, 0)
  result.historyTokens = selectedTokens
  result.messages.push(...selected.map(s => s.msg))
  result.totalTokens = systemTokens + toolSchemaTokens + memoryTokens + selectedTokens

  return result
}
