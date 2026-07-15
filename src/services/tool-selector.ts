import type { Intent, ClassificationResult } from '@/services/intent-classifier'
import type { ToolName } from '@/services/tools'

export interface ToolSuggestion {
  tool: ToolName
  args: Record<string, any>
  priority: number
  reasoning: string
}

export interface ToolSelectionResult {
  suggestions: ToolSuggestion[]
  needsTools: boolean
  parallelGroups: string[][]
  reasoning: string
}

function extractQueries(message: string): string[] {
  const queries: string[] = []

  const afterSearchKeywords = message.match(/(?:search|look up|find|lookup)\s+(?:for\s+)?["""]?([^""".!?\n]+)["""]?/i)
  if (afterSearchKeywords) queries.push(afterSearchKeywords[1].trim())

  const questions = message.match(/(?:what|how|why|when|where|who|which)\s+(?:is|are|was|were|does|do|can|will)\s+(.+?)(?=[,.]|$)/gi)
  if (questions) queries.push(...questions.map(q => q.trim()))

  const quoted = message.match(/["""]([^"""]{10,})["""]/g)
  if (quoted) queries.push(...quoted.map(q => q.replace(/["""]/g, '').trim()))

  if (queries.length === 0 && message.split(/\s+/).length > 3) {
    queries.push(message.slice(0, 200))
  }

  return [...new Set(queries)].slice(0, 3)
}

function extractUrls(message: string): string[] {
  const urls = message.match(/https?:\/\/[^\s,;)]+/g)
  return urls ? [...new Set(urls)] : []
}

function extractCodeSnippets(message: string): string[] {
  const snippets: string[] = []
  const codeBlockRegex = /```(?:\w+)?\s*\n([\s\S]*?)```/g
  let match
  while ((match = codeBlockRegex.exec(message)) !== null) {
    snippets.push(match[1].trim())
  }
  return snippets
}

function extractRepoRefs(message: string): string[] {
  const refs = message.match(/[a-zA-Z0-9_-]+\/[a-zA-Z0-9._-]+/g)
  return refs ? [...new Set(refs.filter(r => !r.includes('.')))] : []
}

function intentNeedsTools(intent: Intent, confidence: number): boolean {
  if (intent === 'conversational' || intent === 'feedback') return false
  if (intent === 'factual' && confidence > 0.8) return true
  return true
}

const INTENT_TOOL_MAP: Record<Intent, { tool: ToolName; priority: number; condition: (msg: string) => boolean }[]> = {
  factual: [
    { tool: 'web_search', priority: 10, condition: () => true },
  ],
  code: [
    { tool: 'web_search', priority: 5, condition: (m) => /\b(search|find|how to|example|docs?|documentation|latest|current)\b/i.test(m) },
    { tool: 'execute_code', priority: 10, condition: (m) => extractCodeSnippets(m).length > 0 || /\b(run|execute|test|try|output|result)\b/i.test(m) },
    { tool: 'github_action', priority: 3, condition: (m) => extractRepoRefs(m).length > 0 || /\b(repo|repository|github|clone|pull)\b/i.test(m) },
  ],
  creative: [],
  analysis: [
    { tool: 'web_search', priority: 10, condition: (m) => /\b(search|find|data|information|compare|latest|current|news)\b/i.test(m) },
    { tool: 'execute_code', priority: 8, condition: (m) => extractCodeSnippets(m).length > 0 || /\b(calculate|compute|process|analyze|run|execute)\b/i.test(m) },
  ],
  command: [
    { tool: 'web_search', priority: 10, condition: (m) => /\b(search|find|look up|lookup)\b/i.test(m) },
    { tool: 'fetch_url', priority: 10, condition: (m) => extractUrls(m).length > 0 },
    { tool: 'execute_code', priority: 10, condition: (m) => /\b(code|run|execute|eval)\b/i.test(m) || extractCodeSnippets(m).length > 0 },
    { tool: 'github_action', priority: 10, condition: (m) => /\b(github|repo|repository)\b/i.test(m) || extractRepoRefs(m).length > 0 },
    { tool: 'safe_browsing_check', priority: 10, condition: (m) => /\b(check|scan|safe|secure)\b/i.test(m) && extractUrls(m).length > 0 },
  ],
  'multi-step': [
    { tool: 'web_search', priority: 5, condition: (m) => /\b(research|search|find|look up|current|latest|docs)\b/i.test(m) },
    { tool: 'execute_code', priority: 10, condition: (m) => /\b(code|implement|build|create|write|function)\b/i.test(m) || extractCodeSnippets(m).length > 0 },
    { tool: 'github_action', priority: 8, condition: (m) => extractRepoRefs(m).length > 0 || /\b(repo|repository|github)\b/i.test(m) },
    { tool: 'fetch_url', priority: 3, condition: (m) => extractUrls(m).length > 0 },
  ],
  conversational: [],
  feedback: [],
}

export function selectTools(
  message: string,
  classification: ClassificationResult,
  availableTools?: ToolName[]
): ToolSelectionResult {
  if (!intentNeedsTools(classification.intent, classification.confidence)) {
    return { suggestions: [], needsTools: false, parallelGroups: [], reasoning: `Intent "${classification.intent}" does not require tools` }
  }

  const suggestions: ToolSuggestion[] = []
  const urls = extractUrls(message)
  const queries = extractQueries(message)
  const snippets = extractCodeSnippets(message)
  const repoRefs = extractRepoRefs(message)

  const candidates = INTENT_TOOL_MAP[classification.intent] || []

  for (const candidate of candidates) {
    if (availableTools && !availableTools.includes(candidate.tool)) continue
    if (!candidate.condition(message)) continue

    const args: Record<string, any> = {}

    switch (candidate.tool) {
      case 'web_search':
        if (queries.length > 0) {
          args.query = queries[0]
          args.max_results = 5
        } else {
          args.query = message.slice(0, 200)
          args.max_results = 5
        }
        break
      case 'fetch_url':
        if (urls.length > 0) args.url = urls[0]
        break
      case 'execute_code':
        if (snippets.length > 0) {
          args.code = snippets[0]
        } else {
          args.code = message
        }
        args.timeout = 5000
        break
      case 'github_action':
        if (repoRefs.length > 0) {
          const parts = repoRefs[0].split('/')
          args.action = 'get-repo'
          args.repo = repoRefs[0]
          args.owner = parts[0]
        } else {
          args.action = 'user-info'
        }
        break
      case 'search_memory':
        args.query = queries[0] || message.slice(0, 100)
        break
    }

    if (Object.keys(args).length > 0 || candidate.tool === 'github_action') {
      suggestions.push({
        tool: candidate.tool,
        args,
        priority: candidate.priority,
        reasoning: `Selected for ${classification.intent} intent: ${candidate.condition.toString().slice(0, 60)}`,
      })
    }
  }

  suggestions.sort((a, b) => b.priority - a.priority)

  const parallelGroups: string[][] = []
  if (suggestions.length > 1) {
    const firstTool = suggestions[0].tool
    const rest = suggestions.filter(s => s.tool !== firstTool).map(s => s.tool)
    if (rest.length > 0) parallelGroups.push([firstTool], rest)
  }

  return {
    suggestions,
    needsTools: suggestions.length > 0,
    parallelGroups,
    reasoning: suggestions.length > 0
      ? `Selected ${suggestions.length} tool(s): ${suggestions.map(s => `${s.tool} (priority ${s.priority})`).join(', ')}`
      : `No tools needed for this ${classification.intent} request`,
  }
}
