import { env } from '@/config/env'

const PROVIDERS = {
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    key: () => env.ai.groqKey,
    strengths: ['speed', 'reasoning', 'coding'],
  },
  cerebras: {
    baseUrl: 'https://api.cerebras.ai/v1',
    models: ['llama-3.3-70b', 'llama-3.1-70b'],
    key: () => env.ai.cerebrasKey,
    strengths: ['speed', 'ultra-fast'],
  },
  fireworks: {
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    models: ['accounts/fireworks/models/llama-v3p3-70b-instruct', 'accounts/fireworks/models/llama-v3p1-70b-instruct'],
    key: () => env.ai.fireworksKey,
    strengths: ['speed', 'open-source'],
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    models: ['deepseek-chat', 'deepseek-coder'],
    key: () => env.ai.deepseekKey,
    strengths: ['coding', 'reasoning', 'math'],
  },
  mistral: {
    baseUrl: 'https://api.mistral.ai/v1',
    models: ['mistral-large', 'mistral-medium', 'mistral-small'],
    key: () => env.ai.mistralKey,
    strengths: ['reasoning', 'multilingual', 'function-calling'],
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.3-70b-instruct', 'google/gemini-pro'],
    key: () => env.ai.openrouterKey,
    strengths: ['gpt-4o', 'claude', 'variety'],
  },
  cloudflare: {
    baseUrl: `https://api.cloudflare.com/client/v4/accounts/${env.ai.cloudflareAccountId}/ai/run`,
    models: ['@cf/meta/llama-3.3-70b-instruct', '@cf/meta/llama-3.1-8b-instruct', '@cf/mistral/mistral-7b-instruct-v0.1', '@cf/deepseek/deepseek-r1-distill-qwen-32b'],
    key: () => env.ai.cloudflareApiToken,
    accountId: env.ai.cloudflareAccountId,
    accessId: env.ai.cloudflareAccessId,
    useGateway: true,
    strengths: ['edge', 'free-tier', 'privacy'],
  },
}

export type ProviderId = keyof typeof PROVIDERS

export interface ParallelExecutionConfig {
  prompt: string
  systemPrompt?: string
  models: { provider: ProviderId; model: string }[]
  temperature?: number
  maxTokens?: number
  parallel?: boolean
  timeout?: number
  taskType?: 'coding' | 'reasoning' | 'speed' | 'analysis' | 'general'
}

export interface ModelResponse {
  provider: ProviderId
  model: string
  content: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  latency: number
  error?: string
}

export interface ParallelExecutionResult {
  responses: ModelResponse[]
  aggregated?: string
  totalLatency: number
  successful: number
  failed: number
}

function getProviderConfig(provider: ProviderId) {
  return PROVIDERS[provider]
}

async function callModel(
  provider: ProviderId,
  model: string,
  messages: { role: string; content: string }[],
  options: { temperature?: number; maxTokens?: number; timeout?: number }
): Promise<ModelResponse> {
  const start = Date.now()
  const providerConfig = PROVIDERS[provider]
  const apiKey = providerConfig.key()

  if (!apiKey) {
    return {
      provider,
      model,
      content: '',
      latency: Date.now() - start,
      error: `No API key for ${provider}`,
    }
  }

  const body = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4096,
    stream: false,
  }

  let url = `${providerConfig.baseUrl}/chat/completions`
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
  }

  if (provider === 'cloudflare') {
    url = `${providerConfig.baseUrl}/${model}`
    headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    }
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeout ?? 60000)

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: controller.signal,
    })

    clearTimeout(timeout)

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      return {
        provider,
        model,
        content: '',
        latency: Date.now() - start,
        error: `HTTP ${response.status}: ${error.error?.message || response.statusText}`,
      }
    }

    const data = await response.json()

    let content = ''
    if (provider === 'cloudflare') {
      content = data.result?.response || data.result || JSON.stringify(data)
    } else {
      content = data.choices?.[0]?.message?.content || ''
    }

    return {
      provider,
      model,
      content,
      usage: data.usage,
      latency: Date.now() - start,
    }
  } catch (err) {
    return {
      provider,
      model,
      content: '',
      latency: Date.now() - start,
      error: err instanceof Error ? err.message : 'Unknown error',
    }
  }
}

function selectModelsForTask(taskType: string, availableProviders: ProviderId[]): { provider: ProviderId; model: string }[] {
  const taskModels: Record<string, { provider: ProviderId; model: string }[]> = {
    coding: [
      { provider: 'deepseek', model: 'deepseek-coder' },
      { provider: 'groq', model: 'llama-3.3-70b-versatile' },
      { provider: 'fireworks', model: 'accounts/fireworks/models/llama-v3p3-70b-instruct' },
      { provider: 'cerebras', model: 'llama-3.3-70b' },
    ],
    reasoning: [
      { provider: 'deepseek', model: 'deepseek-chat' },
      { provider: 'groq', model: 'llama-3.3-70b-versatile' },
      { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet' },
      { provider: 'mistral', model: 'mistral-large' },
    ],
    speed: [
      { provider: 'cerebras', model: 'llama-3.3-70b' },
      { provider: 'groq', model: 'llama-3.1-8b-instant' },
      { provider: 'fireworks', model: 'accounts/fireworks/models/llama-v3p3-70b-instruct' },
      { provider: 'cloudflare', model: '@cf/meta/llama-3.3-70b-instruct' },
    ],
    analysis: [
      { provider: 'openrouter', model: 'anthropic/claude-3.5-sonnet' },
      { provider: 'mistral', model: 'mistral-large' },
      { provider: 'deepseek', model: 'deepseek-chat' },
      { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    ],
    general: [
      { provider: 'groq', model: 'llama-3.3-70b-versatile' },
      { provider: 'openrouter', model: 'openai/gpt-4o' },
      { provider: 'fireworks', model: 'accounts/fireworks/models/llama-v3p3-70b-instruct' },
      { provider: 'cloudflare', model: '@cf/meta/llama-3.3-70b-instruct' },
    ],
  }

  const models = taskModels[taskType] || taskModels.general
  return models.filter(m => availableProviders.includes(m.provider))
}

export async function executeParallel(config: ParallelExecutionConfig): Promise<ParallelExecutionResult> {
  const start = Date.now()

  const providerIds = (Object.keys(PROVIDERS) as ProviderId[])
  const availableProviders = providerIds.filter(p => PROVIDERS[p].key())

  let models = config.models
  if (!models.length && config.taskType) {
    models = selectModelsForTask(config.taskType, availableProviders)
  }
  if (!models.length) {
    models = [{ provider: 'groq', model: 'llama-3.3-70b-versatile' }]
  }

  const validModels = models.filter(m => {
    const p = PROVIDERS[m.provider]
    return p && p.key()
  })

  const messages = [
    ...(config.systemPrompt ? [{ role: 'system', content: config.systemPrompt }] : []),
    { role: 'user', content: config.prompt },
  ]

  const modelCalls = validModels.map(({ provider, model }) =>
    callModel(provider, model, messages, {
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      timeout: config.timeout,
    })
  )

  const responses = config.parallel !== false
    ? await Promise.all(modelCalls)
    : await modelCalls.reduce(async (acc, call) => [...(await acc), await call], Promise.resolve([] as ModelResponse[]))

  const successful = responses.filter(r => !r.error).length
  const failed = responses.filter(r => !!r.error).length

  return {
    responses,
    totalLatency: Date.now() - start,
    successful,
    failed,
  }
}

export async function executeWithAggregation(
  config: ParallelExecutionConfig,
  aggregatorPrompt?: string
): Promise<ParallelExecutionResult> {
  const result = await executeParallel(config)

  const validResponses = result.responses.filter(r => !r.error && r.content)
  if (validResponses.length === 0) return result
  if (validResponses.length === 1) return { ...result, aggregated: validResponses[0].content }

  const aggregator = aggregatorPrompt || `You are an expert synthesizer. Combine the following responses from different AI models into a single, comprehensive, and coherent answer. Preserve the best insights from each. Eliminate redundancy. Structure clearly.

Responses:
{{RESPONSES}}`

  const responsesText = validResponses
    .map((r, i) => `--- Model ${i + 1} (${r.provider}/${r.model}) ---\n${r.content}`)
    .join('\n\n')

  const aggregated = await callModel(
    'groq',
    'llama-3.3-70b-versatile',
    [
      { role: 'system', content: 'You are a synthesis expert. Combine multiple AI responses into one superior answer.' },
      { role: 'user', content: aggregator.replace('{{RESPONSES}}', responsesText) },
    ],
    { temperature: 0.3, maxTokens: 8192 }
  )

  return {
    ...result,
    aggregated: aggregated.error ? validResponses[0].content : aggregated.content,
  }
}

export function getAvailableModels(): Record<ProviderId, string[]> {
  const available: Record<ProviderId, string[]> = {} as any
  for (const [id, provider] of Object.entries(PROVIDERS)) {
    available[id as ProviderId] = provider.key() ? provider.models : []
  }
  return available
}

export function getAllModels(): { provider: ProviderId; model: string; available: boolean }[] {
  const all: { provider: ProviderId; model: string; available: boolean }[] = []
  for (const [providerId, provider] of Object.entries(PROVIDERS)) {
    const hasKey = !!provider.key()
    for (const model of provider.models) {
      all.push({ provider: providerId as ProviderId, model, available: hasKey })
    }
  }
  return all
}

export function getBestModelForTask(taskType: string): { provider: ProviderId; model: string } | null {
  const providerIds = (Object.keys(PROVIDERS) as ProviderId[])
  const available = providerIds.filter(p => PROVIDERS[p].key())
  if (!available.length) return null
  const models = selectModelsForTask(taskType, available)
  return models[0] || null
}