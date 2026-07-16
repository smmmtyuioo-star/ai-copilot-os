import { classifyIntent } from '@/services/intent-classifier'
import { resolveAmbiguity } from '@/services/ambiguity-resolver'
import { selectTools } from '@/services/tool-selector'
import { selectTier } from '@/services/tier-router'
import { matchFormat } from '@/services/format-matcher'
import { verify } from '@/services/verification'
import { runAgentLoop } from '@/services/agent-loop'
import { buildSystemPrompt } from '@/services/system-prompt'
import { learnFromMessage, getProfileContext } from '@/services/user-profile'
import { prepareContext } from '@/services/context'
import type { Intent } from '@/services/intent-classifier'
import type { ToolName } from '@/services/tools'

export interface OrchestratorInput {
  message: string
  history?: { role: string; content: string }[]
  userId?: string
  availableTools?: ToolName[]
  explicitModel?: string
  prefersFast?: boolean
  prefersThorough?: boolean
}

export interface OrchestratorStep {
  step: string
  detail: string
}

export interface OrchestratorResult {
  content: string
  steps: OrchestratorStep[]
  intent: Intent
  tier: string
  format: string
  assumptions: string[]
  warnings: string[]
  profileLearned: string[]
}

export async function orchestrate(input: OrchestratorInput): Promise<OrchestratorResult> {
  const steps: OrchestratorStep[] = []
  const assumptions: string[] = []
  const warnings: string[] = []
  let profileLearned: string[] = []

  const addStep = (step: string, detail: string) => steps.push({ step, detail })

  try {

  addStep('parse', 'Analyzing request and context')

  const classification = await classifyIntent(input.message)
  addStep('classify', `Detected intent: ${classification.intent} (confidence: ${classification.confidence})`)

  const ambiguity = resolveAmbiguity(input.message, {
    history: input.history,
    availableTools: input.availableTools,
  })
  if (ambiguity.needsClarification) {
    return {
      content: ambiguity.clarifyingQuestion || 'Could you clarify what you need?',
      steps: [...steps, { step: 'clarify', detail: ambiguity.clarifyingQuestion || 'Ambiguous request' }],
      intent: classification.intent,
      tier: 'fast',
      format: 'text',
      assumptions: [],
      warnings: [],
      profileLearned: [],
    }
  }
  if (ambiguity.assumptions.length > 0) {
    assumptions.push(...ambiguity.assumptions.map(a => `${a.field}=${a.value}`))
    addStep('assume', `Making assumptions: ${assumptions.join(', ')}`)
  }

  if (input.userId) {
    const learned = learnFromMessage(input.message, input.userId)
    if (learned.learned > 0) {
      profileLearned = learned.newPrefs
      addStep('learn', `Learned ${learned.learned} new preference(s): ${learned.newPrefs.join(', ')}`)
    }
  }

  addStep('tier', `Selecting processing tier`)
  const tierConfig = selectTier({
    intent: classification.intent,
    messageLength: input.message.length,
    explicitModel: input.explicitModel,
    prefersFast: input.prefersFast,
    prefersThorough: input.prefersThorough,
  })
  addStep('tier', `Tier: ${tierConfig.tier}, model: ${tierConfig.model}, max turns: ${tierConfig.maxTurns}`)

  if (classification.intent === 'conversational' || classification.intent === 'feedback') {
    const formatConfig = matchFormat(input.message, classification.intent)
    addStep('respond', `Simple ${classification.intent} — responding directly`)
    return {
      content: '',
      steps,
      intent: classification.intent,
      tier: tierConfig.tier,
      format: formatConfig.format,
      assumptions,
      warnings: [],
      profileLearned,
    }
  }

  const formatConfig = matchFormat(input.message, classification.intent)
  addStep('format', `Format: ${formatConfig.length}/${formatConfig.format}`)

  addStep('select-tools', `Selecting tools`)
  const toolSelection = selectTools(input.message, classification, input.availableTools)
  if (toolSelection.needsTools) {
    addStep('tools', `Selected: ${toolSelection.suggestions.map(s => `${s.tool}(p${s.priority})`).join(', ')}`)
  } else {
    addStep('tools', `No tools needed`)
  }

  addStep('gather', 'Gathering context')
  const profileContext = input.userId ? getProfileContext(input.userId) : ''

  const historyMessages = input.history || []
  const userMsg = { role: 'user' as const, content: input.message }
  const allMessages = [...historyMessages, userMsg]

  const systemPrompt = buildSystemPrompt({
    intent: classification.intent,
    responseLength: formatConfig.length,
    responseFormat: formatConfig.format,
    tools: toolSelection.suggestions.map(s => s.tool),
    hasMemory: tierConfig.useMemory,
    profileContext: profileContext || undefined,
    ambiguityNotes: assumptions.length > 0 ? assumptions.join('; ') : undefined,
  })

  addStep('execute', 'Running task')

  let content: string
  let resultTurns = 1
  let resultToolCalls = 0

  if (toolSelection.needsTools && toolSelection.suggestions.length > 0) {
    const contextResult = await prepareContext(allMessages, {
      systemPrompt,
      maxTokens: tierConfig.maxTokens,
      memoryQuery: input.message,
      userId: input.userId,
      maxMemories: tierConfig.useMemory ? 5 : 0,
    })

    const agentResult = await runAgentLoop({
      messages: contextResult.messages,
      tools: toolSelection.suggestions.map(s => s.tool),
      model: tierConfig.model,
      temperature: tierConfig.temperature,
      maxTokens: tierConfig.maxTokens,
      userId: input.userId,
      maxTurns: tierConfig.maxTurns,
      systemPrompt,
    })

    content = agentResult.content
    resultTurns = agentResult.turns
    resultToolCalls = agentResult.toolCalls
    addStep('complete', `Agent loop: ${resultTurns} turn(s), ${resultToolCalls} tool call(s)`)
  } else {
    content = ''
    addStep('complete', `Direct response (no tools needed)`)
  }

  addStep('verify', 'Verifying response')
  if (tierConfig.useVerification) {
    const verification = await verify({
      response: content,
      originalRequest: input.message,
      intent: classification.intent,
      expectedLength: formatConfig.length,
    })
    if (!verification.passed) {
      warnings.push(...verification.issues.map(i => i.detail))
      addStep('verify', `${verification.issues.length} issue(s) found, score: ${verification.score}`)
    } else {
      addStep('verify', `Passed (score: ${verification.score})`)
    }
  } else {
    addStep('verify', `Skipped (${tierConfig.tier} tier)`)
  }

  addStep('deliver', `Formatting response (${formatConfig.length}/${formatConfig.format})`)

  if (warnings.length > 0) {
    content += '\n\n' + warnings.map(w => `[Note: ${w}]`).join('\n')
  }

    return {
      content,
      steps,
      intent: classification.intent,
      tier: tierConfig.tier,
      format: formatConfig.format,
      assumptions,
      warnings,
      profileLearned,
    }
  } catch (err) {
    console.error('Task orchestrator failed at step:', steps[steps.length - 1]?.step || 'unknown', err)
    return {
      content: `I encountered an error while processing your request. Please try rephrasing.`,
      steps: [...steps, { step: 'error', detail: err instanceof Error ? err.message : 'Unknown error' }],
      intent: 'factual' as any,
      tier: 'fast',
      format: 'text',
      assumptions,
      warnings: ['An internal error occurred. Please try again.'],
      profileLearned,
    }
  }
}
