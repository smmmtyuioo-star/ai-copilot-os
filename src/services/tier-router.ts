import type { Intent } from '@/services/intent-classifier'
import type { ToolName } from '@/services/tools'

export type Tier = 'fast' | 'balanced' | 'thorough'

export interface TierConfig {
  tier: Tier
  model: string
  maxTurns: number
  maxTools: number
  temperature: number
  maxTokens: number
  useVerification: boolean
  useMemory: boolean
  reasoning: string
}

const TIER_CONFIGS: Record<Tier, Omit<TierConfig, 'reasoning'>> = {
  fast: {
    tier: 'fast',
    model: 'llama-3.1-8b-instant',
    maxTurns: 1,
    maxTools: 1,
    temperature: 0.3,
    maxTokens: 1024,
    useVerification: false,
    useMemory: false,
  },
  balanced: {
    tier: 'balanced',
    model: 'llama-3.3-70b-versatile',
    maxTurns: 5,
    maxTools: 3,
    temperature: 0.5,
    maxTokens: 4096,
    useVerification: true,
    useMemory: true,
  },
  thorough: {
    tier: 'thorough',
    model: 'llama-3.3-70b-versatile',
    maxTurns: 10,
    maxTools: 10,
    temperature: 0.7,
    maxTokens: 8192,
    useVerification: true,
    useMemory: true,
  },
}

const INTENT_TIER_MAP: Record<Intent, { tier: Tier; reason: string }> = {
  conversational: { tier: 'fast', reason: 'Casual chat needs minimal processing' },
  feedback: { tier: 'fast', reason: 'Corrections need quick acknowledgment' },
  factual: { tier: 'balanced', reason: 'Factual queries may need search but not complex reasoning' },
  command: { tier: 'balanced', reason: 'Commands need tool execution but not multi-step planning' },
  creative: { tier: 'balanced', reason: 'Creative tasks need quality but not deep tool use' },
  code: { tier: 'thorough', reason: 'Code needs careful generation with verification' },
  analysis: { tier: 'thorough', reason: 'Analysis needs multiple perspectives and verification' },
  'multi-step': { tier: 'thorough', reason: 'Complex tasks need full agent loop with planning' },
}

export interface TierRequest {
  intent: Intent
  messageLength: number
  explicitModel?: string
  prefersThorough?: boolean
  prefersFast?: boolean
}

export function selectTier(request: TierRequest): TierConfig {
  if (request.explicitModel) {
    const isSmallModel = request.explicitModel.includes('8b') || request.explicitModel.includes('small')
    const tier = isSmallModel ? 'fast' : 'balanced'
    return { ...TIER_CONFIGS[tier], model: request.explicitModel, reasoning: `Explicit model "${request.explicitModel}" → ${tier} tier` }
  }

  if (request.prefersThorough) {
    return { ...TIER_CONFIGS.thorough, reasoning: 'User prefers thorough responses' }
  }

  if (request.prefersFast) {
    return { ...TIER_CONFIGS.fast, reasoning: 'User prefers fast responses' }
  }

  const mapped = INTENT_TIER_MAP[request.intent]
  if (mapped) {
    return { ...TIER_CONFIGS[mapped.tier], reasoning: mapped.reason }
  }

  return { ...TIER_CONFIGS.balanced, reasoning: 'Default: balanced tier' }
}
