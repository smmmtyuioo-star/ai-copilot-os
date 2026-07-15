import type { Intent } from '@/services/intent-classifier'

export type ResponseFormat = 'text' | 'markdown' | 'code' | 'table' | 'list' | 'json'
export type ResponseLength = 'short' | 'medium' | 'long'

export interface FormatConfig {
  format: ResponseFormat
  length: ResponseLength
  maxSentences?: number
  useCodeBlocks: boolean
  useHeadings: boolean
  useLists: boolean
  useTables: boolean
  reasoning: string
}

const CONCISE_PATTERNS = [
  /\b(in\s+)?(short|brief|briefly|tl;dr|tl dr|summarize|summary|concise|quickly|quick)\b/i,
  /\b(in\s+)?(\d+\s+(sentences|words|lines|bullet))\b/i,
  /\b(just\s+)?(tell|answer|give)\s+(me\s+)?(the\s+)?(answer|result)\b/i,
  /\b(too long|don't explain|no explanation|skip the)\b/i,
  /\b(1-2\s+sentences|one sentence|two sentences)\b/i,
]

const DETAILED_PATTERNS = [
  /\b(in\s+)?(detail|details|comprehensive|thorough|in-depth|in depth|exhaustive)\b/i,
  /\b(explain|elaborate|expand|walk through|break down)\s+(in\s+)?(detail|thoroughly|step)\b/i,
  /\b(step by step|step-by-step|steps|guide|tutorial|walkthrough)\b/i,
  /\b(with\s+)?(examples?|code\s+sample|demonstration|illustration)\b/i,
  /\b(full|complete|entire|everything|all\s+the)\s+(details?|explanation|guide|documentation)\b/i,
]

const FORMAT_PATTERNS: { format: ResponseFormat; patterns: RegExp[] }[] = [
  {
    format: 'code',
    patterns: [
      /\b(output|return|show|print|log)\s+(the\s+)?code\b/i,
      /\b(generate|write|create|show)\s+(code|script|function|class)\b/i,
      /```/,
    ],
  },
  {
    format: 'table',
    patterns: [
      /\b(as\s+)?(a\s+)?table\b/i,
      /\b(compare|comparison|differences?|similarities?)\s+(in\s+)?(a\s+)?table\b/i,
      /\b(tabular|columns|rows|spreadsheet)\b/i,
    ],
  },
  {
    format: 'list',
    patterns: [
      /\b(as\s+)?(a\s+)?(list|bullet|checklist|items)\b/i,
      /\b(list|enumerate|itemize)\s+(the|all|each|every)\b/i,
    ],
  },
  {
    format: 'json',
    patterns: [
      /\b(as\s+)?json\b/i,
      /\b(structured\s+)?(data|output)\s+(as|in)\s+json\b/i,
    ],
  },
]

const RESPONSE_LENGTH_GUIDE: Record<Intent, { length: ResponseLength; reason: string }> = {
  factual: { length: 'medium', reason: 'Factual queries need enough context to be useful' },
  code: { length: 'long', reason: 'Code output requires full implementation' },
  creative: { length: 'medium', reason: 'Creative output balanced for readability' },
  analysis: { length: 'medium', reason: 'Analysis needs explanation plus key points' },
  command: { length: 'short', reason: 'Commands need concise results' },
  'multi-step': { length: 'long', reason: 'Complex tasks need thorough breakdown' },
  conversational: { length: 'short', reason: 'Casual conversation should be brief' },
  feedback: { length: 'short', reason: 'Acknowledge and respond concisely' },
}

function detectLength(message: string): { length: ResponseLength; reason: string } | null {
  if (CONCISE_PATTERNS.some(p => p.test(message))) {
    return { length: 'short', reason: 'User requested concise response' }
  }
  if (DETAILED_PATTERNS.some(p => p.test(message))) {
    return { length: 'long', reason: 'User requested detailed response' }
  }
  return null
}

function detectFormat(message: string): { format: ResponseFormat; reason: string } | null {
  for (const entry of FORMAT_PATTERNS) {
    if (entry.patterns.some(p => p.test(message))) {
      return { format: entry.format, reason: `User requested ${entry.format} format` }
    }
  }
  return null
}

export function matchFormat(message: string, intent: Intent): FormatConfig {
  const explicitLength = detectLength(message)
  const explicitFormat = detectFormat(message)
  const intentDefaults = RESPONSE_LENGTH_GUIDE[intent] || { length: 'medium' as ResponseLength, reason: 'Default for intent' }

  const length: ResponseLength = explicitLength?.length || intentDefaults.length
  const format: ResponseFormat = explicitFormat?.format || 'markdown'

  const reasons: string[] = [explicitLength?.reason || intentDefaults.reason]
  if (explicitFormat) reasons.push(explicitFormat.reason)

  const config: FormatConfig = {
    format,
    length,
    useCodeBlocks: format === 'code' || intent === 'code',
    useHeadings: length === 'long' && format === 'markdown',
    useLists: length !== 'short' || format === 'list',
    useTables: format === 'table',
    reasoning: reasons.join('; ') || 'Default format',
  }

  if (length === 'short') {
    config.maxSentences = 3
    config.useHeadings = false
    config.useLists = false
    config.useTables = false
  } else if (length === 'medium') {
    config.maxSentences = 10
  } else {
    config.maxSentences = undefined
  }

  return config
}
