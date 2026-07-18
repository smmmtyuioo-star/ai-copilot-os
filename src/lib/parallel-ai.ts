import { env } from '@/config/env'

const PROVIDERS = {
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
    key: () => env.ai.groqKey,
    strengths: ['speed', 'reasoning', 'coding'],
  },
  mistral: {
    baseUrl: 'https://api.mistral.ai/v1',
    models: ['mistral-medium', 'mistral-small'],
    key: () => env.ai.mistralKey,
    strengths: ['reasoning', 'multilingual', 'function-calling'],
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    models: ['openai/gpt-4o', 'meta-llama/llama-3.3-70b-instruct'],
    key: () => env.ai.openrouterKey,
    strengths: ['gpt-4o', 'variety'],
  },
  nvidia: {
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    models: ['nvidia/nemotron-3-ultra-550b-a55b', 'deepseek-ai/deepseek-v4-flash'],
    key: () => env.ai.nvidiaKey,
    strengths: ['reasoning', 'coding', 'accuracy', 'speed'],
  },
  cloudflare: {
    baseUrl: `https://api.cloudflare.com/client/v4/accounts/${env.ai.cloudflareAccountId}/ai/run`,
    models: ['@cf/meta/llama-3.1-8b-instruct-fp8-fp8', '@cf/meta/llama-3.2-3b-instruct'],
    key: () => env.ai.cloudflareApiToken,
    accountId: env.ai.cloudflareAccountId,
    useGateway: true,
    strengths: ['edge', 'free-tier', 'speed'],
  },
  tavily: {
    baseUrl: 'https://api.tavily.com',
    models: ['tavily-search', 'tavily-extract'],
    key: () => env.ai.tavilyKey,
    strengths: ['search', 'background-data', 'real-time', 'citations'],
    isSearch: true,
  },
  googleSafeBrowsing: {
    baseUrl: 'https://safebrowsing.googleapis.com/v4',
    models: ['url-check', 'threat-list'],
    key: () => env.ai.googleSafeBrowsingKey,
    strengths: ['url-safety', 'phishing', 'malware', 'unwanted-software'],
    isSecurity: true,
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
  taskType?: 'coding' | 'reasoning' | 'speed' | 'analysis' | 'general' | 'search' | 'security'
}

export interface ModelResponse {
  provider: ProviderId
  model: string
  content: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  latency: number
  error?: string
  citations?: string[]
}

export interface ParallelExecutionResult {
  responses: ModelResponse[]
  aggregated?: string
  totalLatency: number
  successful: number
  failed: number
}

function selectModelsForTask(taskType: string, availableProviders: string[]): { provider: ProviderId; model: string }[] {
  const taskModels: Record<string, { provider: ProviderId; model: string }[]> = {
    coding: [
      { provider: 'groq', model: 'llama-3.3-70b-versatile' },
      { provider: 'openrouter', model: 'openai/gpt-4o' },
      { provider: 'nvidia', model: 'nvidia/nemotron-3-ultra-550b-a55b' },
      { provider: 'mistral', model: 'mistral-medium' },
    ],
    reasoning: [
      { provider: 'groq', model: 'llama-3.3-70b-versatile' },
      { provider: 'openrouter', model: 'openai/gpt-4o' },
      { provider: 'nvidia', model: 'nvidia/nemotron-3-ultra-550b-a55b' },
      { provider: 'mistral', model: 'mistral-medium' },
    ],
    speed: [
      { provider: 'groq', model: 'llama-3.1-8b-instant' },
      { provider: 'cloudflare', model: '@cf/meta/llama-3.1-8b-instruct-fp8' },
      { provider: 'nvidia', model: 'deepseek-ai/deepseek-v4-flash' },
      { provider: 'mistral', model: 'mistral-small' },
    ],
    analysis: [
      { provider: 'openrouter', model: 'openai/gpt-4o' },
      { provider: 'groq', model: 'llama-3.3-70b-versatile' },
      { provider: 'nvidia', model: 'nvidia/nemotron-3-ultra-550b-a55b' },
      { provider: 'mistral', model: 'mistral-medium' },
    ],
    search: [
      { provider: 'tavily', model: 'tavily-search' },
      { provider: 'groq', model: 'llama-3.3-70b-versatile' },
    ],
    security: [
      { provider: 'googleSafeBrowsing', model: 'url-check' },
    ],
    general: [
      { provider: 'groq', model: 'llama-3.3-70b-versatile' },
      { provider: 'openrouter', model: 'openai/gpt-4o' },
      { provider: 'nvidia', model: 'deepseek-ai/deepseek-v4-flash' },
      { provider: 'cloudflare', model: '@cf/meta/llama-3.1-8b-instruct-fp8' },
      { provider: 'mistral', model: 'mistral-medium' },
    ],
  }

  const models = taskModels[taskType] || taskModels.general
  return models.filter(m => availableProviders.includes(m.provider))
}

async function callModel(
  provider: ProviderId,
  model: string,
  messages: { role: string; content: string }[],
  options: { temperature?: number; maxTokens?: number; timeout?: number }
): Promise<ModelResponse> {
  const start = Date.now()
  const providerConfig = PROVIDERS[provider]
  const apiKey = (PROVIDERS[provider] as any).key()

  if (!apiKey) {
    return { provider, model, content: '', latency: Date.now() - start, error: `No API key for ${provider}` }
  }

  let url = `${PROVIDERS[provider].baseUrl}/chat/completions`
  let headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${(PROVIDERS[provider] as any).key()}`,
  }
  let body: any = { model, messages, temperature: 0.7, max_tokens: 4096, stream: false }

  if (provider === 'tavily') {
    url = 'https://api.tavily.com/search'
    headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${env.ai.tavilyKey}` }
    body = { query: messages[messages.length - 1].content, search_depth: 'advanced', include_answer: true, max_results: 5 }
  } else if (provider === 'googleSafeBrowsing') {
    url = `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${env.ai.googleSafeBrowsingKey}`
    headers = { 'Content-Type': 'application/json' }
    body = { client: { clientId: 'ai-copilot-os', clientVersion: '1.0' }, threatInfo: { threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'], platformTypes: ['ANY_PLATFORM'], threatEntryTypes: ['URL'], threatEntries: [{ url: messages[messages.length - 1].content }] } }
  } else if (provider === 'cloudflare') {
    url = `https://api.cloudflare.com/client/v4/accounts/${env.ai.cloudflareAccountId}/ai/run/${model}`
    headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${env.ai.cloudflareApiToken}` }
    body = { messages, temperature: 0.7, max_tokens: 4096 }
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
    let citations: string[] = []

    if (provider === 'tavily') {
      content = data.results?.map((r: any) => `${r.title}: ${r.content} (${r.url})`).join('\n\n') || ''
      citations = data.results?.map((r: any) => r.url).filter(Boolean) || []
    } else if (provider === 'googleSafeBrowsing') {
      const threats = data.matches || []
      content = threats.length > 0
        ? `⚠️ UNSAFE: ${threats.map((t: any) => `${t.threatType} (${t.platformType})`).join(', ')}`
        : '✅ SAFE: No threats detected'
    } else if (provider === 'cloudflare') {
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
      citations,
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
  const providerIds = Object.keys(PROVIDERS) as ProviderId[]
  const availableProviders = providerIds.filter(p => (PROVIDERS[p].key?.() || '') !== '')

  let models: { provider: ProviderId; model: string }[] = config.models
  if (!models.length && config.taskType) {
    const providerIds = Object.keys(PROVIDERS) as ProviderId[]
    const availableProviders = providerIds.filter(p => (PROVIDERS[p].key?.() || '') !== '')
    models = selectModelsForTask(config.taskType, availableProviders)
  }
  if (!models.length) models = [{ provider: 'groq', model: 'llama-3.3-70b-versatile' }]

  const validModels = models.filter(m => PROVIDERS[m.provider]?.key?.())
  const messages = [...(config.systemPrompt ? [{ role: 'system', content: config.systemPrompt }] : []), { role: 'user', content: config.prompt }]

  const modelCalls = validModels.map(({ provider, model }) =>
    callModel(provider, model, config.systemPrompt ? [{ role: 'system', content: config.systemPrompt }, { role: 'user', content: config.prompt }] : [{ role: 'user', content: config.prompt }], {
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      timeout: config.timeout,
    })
  )

  const responses = config.parallel !== false
    ? await Promise.all(modelCalls)
    : await (async () => {
        const results: ModelResponse[] = []
        for (const call of modelCalls) {
          results.push(await call)
        }
        return results
      })()

  const successful = responses.filter(r => !r.error).length
  const failed = responses.filter(r => !!r.error).length

  return { responses, totalLatency: Date.now() - start, successful, failed }
}

export async function executeWithAggregation(config: any, aggregatorPrompt?: string) {
  const result = await executeParallel(config)

  const validResponses = result.responses.filter(r => !r.error && r.content)
  if (validResponses.length === 0) return result
  if (validResponses.length === 1) return { ...result, aggregated: validResponses[0].content }

  const aggregator = aggregatorPrompt || `Synthesize these responses into one superior answer. Keep best insights, remove redundancy, structure clearly.

Responses:
{{RESPONSES}}`

  const responsesText = validResponses
    .map((r, i) => `--- Model ${i + 1} (${r.provider}/${r.model}) ---\n${r.content}`)
    .join('\n\n')

  const aggregated = await callModel('groq', 'llama-3.3-70b-versatile', [
    { role: 'system', content: 'You are a synthesis expert. Combine multiple AI responses into one superior answer.' },
    { role: 'user', content: aggregator.replace('{{RESPONSES}}', responsesText) }
  ], { temperature: 0.3, maxTokens: 8192 })

  return { ...result, aggregated: aggregated.error ? validResponses[0].content : aggregated.content }
}

export function getAvailableModels() {
  const available: Record<string, string[]> = {}
  for (const [id, provider] of Object.entries(PROVIDERS)) {
    available[id] = provider.key() ? provider.models : []
  }
  return available
}

export function getAllModels() {
  const all: { provider: string; model: string; available: boolean }[] = []
  for (const [providerId, provider] of Object.entries(PROVIDERS)) {
    const hasKey = !!provider.key()
    for (const model of provider.models) {
      all.push({ provider: providerId, model, available: hasKey })
    }
  }
  return all
}