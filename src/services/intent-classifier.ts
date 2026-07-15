import { env } from '@/config/env'

export type Intent =
  | 'factual'
  | 'code'
  | 'creative'
  | 'analysis'
  | 'command'
  | 'multi-step'
  | 'conversational'
  | 'feedback'

export interface ClassificationResult {
  intent: Intent
  confidence: number
  suggestedTools: string[]
  needsPlanning: boolean
  reasoning: string
}

const INTENT_PATTERNS: { intent: Intent; patterns: RegExp[]; tools: string[]; confidence: number; needsPlanning: boolean }[] = [
  {
    intent: 'conversational',
    patterns: [/^(hi|hello|hey|howdy|sup|yo)\b/i, /\b(how are you|what's up|good morning|good evening)\b/i, /\b(thanks|thank you|appreciate it)\b/i, /^(bye|goodbye|see you|cya)\b/i],
    tools: [],
    confidence: 0.95,
    needsPlanning: false,
  },
  {
    intent: 'feedback',
    patterns: [/\b(that('s| is) wrong|incorrect|not right|mistake|error|actually|correction|fix this)\b/i, /\b(doesn't work|not working|broken)\b/i],
    tools: [],
    confidence: 0.85,
    needsPlanning: false,
  },
  {
    intent: 'command',
    patterns: [/\b(search|find|look up|lookup|fetch|get|retrieve)\s+/i, /\b(run|execute|call|invoke|trigger)\s+/i, /\b(open|navigate|go to)\s+/i, /^!(search|run|exec)/],
    tools: ['web_search', 'fetch_url', 'execute_code'],
    confidence: 0.9,
    needsPlanning: false,
  },
  {
    intent: 'code',
    patterns: [/\b(write|create|implement|generate|build|make)\s+(a|an|the)\s+(function|class|component|api|route|endpoint|script|program|app|module)\b/i, /\b(fix|debug|refactor|optimize|review)\s+(this|the|my)\s+(code|function|bug|issue)\b/i, /`{3}/, /```[\s\S]*```/, /\b(code|function|algorithm|implement|program)\b.*\b(in|using|with)\s+(javascript|typescript|python|rust|go|react|node)\b/i, /\b(error|bug|buggy|crash|exception)\b.*\b(code|function|fix)\b/i],
    tools: ['execute_code', 'web_search', 'github_action'],
    confidence: 0.85,
    needsPlanning: false,
  },
  {
    intent: 'creative',
    patterns: [/\b(write|compose|create|generate)\s+(a|an)\s+(poem|story|song|script|essay|article|blog)\b/i, /\b(design|create)\s+(a|an)\s+(logo|banner|image|visual|art|illustration)\b/i, /\bbrainstorm\s+(ideas|concepts|names|themes)\b/i],
    tools: [],
    confidence: 0.8,
    needsPlanning: false,
  },
  {
    intent: 'analysis',
    patterns: [/\b(analyze|analyse|compare|contrast|evaluate|assess|review)\s+/i, /\b(explain|break down|walk through)\s+(this|the|how)\b/i, /\bwhat('s| is) the (difference|similarity|best|worst)\b/i, /\b(data|statistics|numbers|metrics|stats)\b.*\b(show|tell|analyze)\b/i],
    tools: ['web_search', 'execute_code'],
    confidence: 0.75,
    needsPlanning: true,
  },
  {
    intent: 'factual',
    patterns: [/^(what|how|why|when|where|who|which)\s+(is|are|was|were|does|do|can|will|would|did)\b/i, /\b(define|explain|tell me about|describe|what is|what are)\s+/i, /\b(meaning|definition|example of)\s+/i],
    tools: ['web_search'],
    confidence: 0.7,
    needsPlanning: false,
  },
  {
    intent: 'multi-step',
    patterns: [/(first|then|next|finally|step\s*\d+).*(second|then|after|finally)/i, /(\bcreate\b.*\bconfigure\b|\bset up\b.*\bdeploy\b|\bbuild\b.*\btest\b|\bdesign\b.*\bimplement\b)/i, /\b(workflow|pipeline|process|sequence|chain|full stack)\s+(of|that|to|for)\b/i],
    tools: ['web_search', 'execute_code', 'github_action', 'fetch_url'],
    confidence: 0.65,
    needsPlanning: true,
  },
]

const LLM_CLASSIFICATION_PROMPT = `Classify the intent of this user message into exactly one category:

- factual: asking for information, definitions, explanations
- code: writing, fixing, reviewing, or debugging code
- creative: generating creative content (poems, stories, etc.)
- analysis: comparing, evaluating, or breaking down data
- command: directly requesting a search, fetch, or execution
- multi-step: complex task requiring multiple steps/planning
- conversational: greeting, thanks, casual chat
- feedback: correction, complaint, "that's wrong"

Respond with ONLY a JSON object:
{"intent": "<category>", "confidence": <0.0-1.0>, "reasoning": "<one-line reason>"}`

export async function classifyIntent(
  message: string,
  useLlm = false
): Promise<ClassificationResult> {
  if (!message || message.trim().length === 0) {
    return { intent: 'conversational', confidence: 0.5, suggestedTools: [], needsPlanning: false, reasoning: 'Empty message' }
  }

  const trimmed = message.trim()

  for (const entry of INTENT_PATTERNS) {
    for (const pattern of entry.patterns) {
      if (pattern.test(trimmed)) {
        return {
          intent: entry.intent,
          confidence: entry.confidence,
          suggestedTools: entry.tools,
          needsPlanning: entry.needsPlanning,
          reasoning: `Matched pattern: ${pattern}`,
        }
      }
    }
  }

  if (trimmed.length > 200 && /\b(and|then|also|additionally|first|second|finally)\b/i.test(trimmed)) {
    return {
      intent: 'multi-step',
      confidence: 0.6,
      suggestedTools: ['web_search', 'execute_code', 'github_action', 'fetch_url'],
      needsPlanning: true,
      reasoning: 'Long message with sequential indicators',
    }
  }

  if (useLlm) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.ai.groqKey}` },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages: [
            { role: 'system', content: LLM_CLASSIFICATION_PROMPT },
            { role: 'user', content: trimmed },
          ],
          temperature: 0.1,
          max_tokens: 100,
        }),
        signal: AbortSignal.timeout(5000),
      })

      if (response.ok) {
        const data = await response.json()
        const content = data.choices?.[0]?.message?.content
        if (content) {
          const parsed = JSON.parse(content)
          const matched = INTENT_PATTERNS.find(e => e.intent === parsed.intent)
          return {
            intent: parsed.intent,
            confidence: parsed.confidence || 0.6,
            suggestedTools: matched?.tools || [],
            needsPlanning: matched?.needsPlanning || false,
            reasoning: parsed.reasoning || 'LLM classification',
          }
        }
      }
    } catch {}
  }

  return {
    intent: 'factual',
    confidence: 0.4,
    suggestedTools: ['web_search'],
    needsPlanning: false,
    reasoning: 'Fallback: default to factual',
  }
}
