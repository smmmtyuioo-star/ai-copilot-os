import { env } from '@/config/env'

const PROVIDERS = {
  omniroute: {
    baseUrl: 'https://api.omniroute.online/v1',
    models: [
      // OpenAI models via OmniRoute
      'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini',
      // Anthropic models via OmniRoute
      'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229',
      // Meta models via OmniRoute
      'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it',
      'meta-llama/Llama-3.3-70B-Instruct-Turbo', 'meta-llama/Llama-3.1-70B-Instruct',
      // Other models via OmniRoute
      'command-r-plus', 'command-r',
      'mistral-large', 'mistral-medium',
      'qwen-2.5-72b', 'qwen-2.5-32b',
    ],
    key: () => env.ai.omnirouteKey,
  },
  // Fallback providers (only used if OmniRoute fails completely)
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
    key: () => env.ai.groqKey,
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
    key: () => env.ai.openaiKey,
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
    key: () => env.ai.anthropicKey,
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

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), options.timeout ?? 60000)

    const response = await fetch(`${providerConfig.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
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
    return {
      provider,
      model,
      content: data.choices?.[0]?.message?.content || '',
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

export async function executeParallel(config: ParallelExecutionConfig): Promise<ParallelExecutionResult> {
  const start = Date.now()
  const messages = [
    ...(config.systemPrompt ? [{ role: 'system', content: config.systemPrompt }] : []),
    { role: 'user', content: config.prompt },
  ]

  const modelCalls = config.models.map(({ provider, model }) =>
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

  if (validResponses.length === 1) {
    return { ...result, aggregated: validResponses[0].content }
  }

  const aggregator = aggregatorPrompt || `You are an expert synthesizer. Combine the following responses from different AI models into a single, comprehensive, and coherent answer. Preserve the best insights from each response. Eliminate redundancy. Structure the final answer clearly.

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