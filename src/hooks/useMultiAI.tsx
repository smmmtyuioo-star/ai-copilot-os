'use client'
import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react'
import type { ModelProvider, AIModel, ChatMessage, ProviderConfig } from '@/types/ai'

const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  omniroute: {
    name: 'OmniRoute',
    baseUrl: 'https://api.omniroute.online/v1',
    envKey: 'OMNIROUTE_API_KEY',
    modelsEndpoint: '/models',
    supportsStreaming: true,
    supportsParallel: true,
  },
  groq: {
    name: 'Groq',
    baseUrl: 'https://api.groq.com/openai/v1',
    envKey: 'GROQ_API_KEY',
    modelsEndpoint: '/models',
    supportsStreaming: true,
    supportsParallel: true,
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    envKey: 'OPENAI_API_KEY',
    modelsEndpoint: '/models',
    supportsStreaming: true,
    supportsParallel: true,
  },
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com/v1',
    envKey: 'ANTHROPIC_API_KEY',
    modelsEndpoint: '/models',
    supportsStreaming: true,
    supportsParallel: false,
  },
}

interface MultiAIState {
  providers: Map<string, ModelProvider>
  activeProvider: string | null
  models: AIModel[]
  loading: boolean
  error: string | null
  
  initializeProvider: (id: string, apiKey: string) => Promise<void>
  removeProvider: (id: string) => void
  setActiveProvider: (id: string) => void
  fetchModels: (providerId: string) => Promise<void>
  
  chat: (params: ChatParams) => Promise<ChatResult>
  chatParallel: (params: ParallelChatParams) => Promise<ParallelChatResult>
  chatStream: (params: ChatParams, onToken: (providerId: string, token: string) => void) => Promise<void>
  
  agentChat: (params: AgentChatParams) => Promise<AgentChatResult>
  agentChatStream: (params: AgentChatParams, onEvent: (event: AgentEvent) => void) => Promise<void>
}

interface ChatParams {
  providerId: string
  model: string
  messages: ChatMessage[]
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

interface ChatResult {
  content: string
  usage?: { promptTokens: number; completionTokens: number; totalTokens: number }
  model: string
  provider: string
}

interface ParallelChatParams {
  requests: Array<ChatParams & { id: string }>
  onProgress?: (completed: number, total: number) => void
}

interface ParallelChatResult {
  results: Map<string, ChatResult>
  errors: Map<string, string>
}

interface AgentChatParams {
  agents: Array<{
    id: string
    name: string
    providerId: string
    model: string
    systemPrompt: string
    tools?: string[]
  }>
  initialMessage: string
  maxRounds?: number
  onRoundComplete?: (round: number, outputs: Map<string, string>) => void
}

interface AgentChatResult {
  conversation: AgentMessage[]
  finalOutput: string
}

interface AgentMessage {
  agentId: string
  agentName: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  round: number
}

type AgentEvent = 
  | { type: 'round_start'; round: number }
  | { type: 'agent_token'; agentId: string; token: string }
  | { type: 'agent_complete'; agentId: string; content: string }
  | { type: 'round_complete'; round: number; outputs: Map<string, string> }
  | { type: 'error'; agentId: string; error: string }

const MultiAIContext = createContext<MultiAIState | null>(null)

export function MultiAIProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MultiAIState>({
    providers: new Map(),
    activeProvider: null,
    models: [],
    loading: false,
    error: null,
    
    initializeProvider: async () => {},
    removeProvider: () => {},
    setActiveProvider: () => {},
    fetchModels: async () => {},
    chat: async () => ({ content: '', model: '', provider: '' }),
    chatParallel: async () => ({ results: new Map(), errors: new Map() }),
    chatStream: async () => {},
    agentChat: async () => ({ conversation: [], finalOutput: '' }),
    agentChatStream: async () => {},
  })

  const initializeProvider = useCallback(async (id: string, apiKey: string) => {
    const config = PROVIDER_CONFIGS[id]
    if (!config) throw new Error(`Unknown provider: ${id}`)
    
    setState(prev => ({ ...prev, loading: true, error: null }))
    
    try {
      const proxyRes = await fetch('/api/ai/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: id, endpoint: '/models', apiKey }),
      })

      if (!proxyRes.ok) {
        const err = await proxyRes.json().catch(() => ({}))
        throw new Error(err.error || `Failed to connect: ${proxyRes.status}`)
      }

      const data = await proxyRes.json()
      const models: AIModel[] = (data.data || data).map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        provider: config.name,
        providerId: id,
        contextWindow: m.context_window || 4096,
        supportsStreaming: config.supportsStreaming,
      }))
      
      const provider: ModelProvider = {
        id,
        name: config.name,
        config,
        apiKey,
        models,
        initialized: true,
      }
      
      setState(prev => {
        const newProviders = new Map(prev.providers)
        newProviders.set(id, provider)
        return {
          ...prev,
          providers: newProviders,
          activeProvider: prev.activeProvider || id,
          models: [...prev.models.filter(m => m.providerId !== id), ...models],
          loading: false,
        }
      })
    } catch (err) {
      setState(prev => ({ ...prev, loading: false, error: err instanceof Error ? err.message : 'Failed to initialize' }))
      throw err
    }
  }, [])

  const removeProvider = useCallback((id: string) => {
    setState(prev => {
      const newProviders = new Map(prev.providers)
      newProviders.delete(id)
      return {
        ...prev,
        providers: newProviders,
        activeProvider: prev.activeProvider === id ? (newProviders.values().next().value?.id || null) : prev.activeProvider,
        models: prev.models.filter(m => m.providerId !== id),
      }
    })
  }, [])

  const setActiveProvider = useCallback((id: string) => {
    setState(prev => ({ ...prev, activeProvider: id }))
  }, [])

  const fetchModels = useCallback(async (providerId: string) => {
    const provider = state.providers.get(providerId)
    if (!provider) return
    
    try {
      const config = PROVIDER_CONFIGS[providerId]
      const proxyRes = await fetch('/api/ai/proxy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider: providerId, endpoint: '/models', apiKey: provider.apiKey }),
      })
      if (!proxyRes.ok) return
      const data = await proxyRes.json()
      const models: AIModel[] = (data.data || data).map((m: any) => ({
        id: m.id, name: m.name || m.id, provider: config?.name || providerId, providerId,
        contextWindow: m.context_window || 4096, supportsStreaming: config?.supportsStreaming ?? true,
      }))
      
      setState(prev => {
        const newProviders = new Map(prev.providers)
        newProviders.set(providerId, { ...provider, models })
        return {
          ...prev,
          providers: newProviders,
          models: [...prev.models.filter(m => m.providerId !== providerId), ...models],
        }
      })
    } catch (err) {
      console.error('Failed to fetch models:', err)
    }
  }, [state.providers])

  const chat = useCallback(async (params: ChatParams): Promise<ChatResult> => {
    const provider = state.providers.get(params.providerId)
    if (!provider) throw new Error(`Provider not initialized: ${params.providerId}`)
    
    const config = PROVIDER_CONFIGS[params.providerId]
    const messages = [
      ...(params.systemPrompt ? [{ role: 'system' as const, content: params.systemPrompt }] : []),
      ...params.messages,
    ]
    
    const proxyRes = await fetch('/api/ai/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: params.providerId,
        endpoint: '/chat/completions',
        apiKey: provider.apiKey,
        body: {
          model: params.model,
          messages,
          temperature: params.temperature ?? 0.7,
          max_tokens: params.maxTokens ?? 4096,
          stream: false,
        },
      }),
    })
    
    if (!proxyRes.ok) {
      const err = await proxyRes.json().catch(() => ({}))
      throw new Error(`${config.name} API error: ${err.error?.message || proxyRes.statusText}`)
    }
    
    const data = await proxyRes.json()
    return {
      content: data.choices[0]?.message?.content || '',
      usage: data.usage,
      model: params.model,
      provider: provider.name,
    }
  }, [state.providers])

  const chatParallel = useCallback(async (params: ParallelChatParams): Promise<ParallelChatResult> => {
    const results = new Map<string, ChatResult>()
    const errors = new Map<string, string>()
    let completed = 0
    
    await Promise.all(params.requests.map(async (req) => {
      try {
        const result = await chat(req)
        results.set(req.id, result)
      } catch (err) {
        errors.set(req.id, err instanceof Error ? err.message : 'Unknown error')
      } finally {
        completed++
        params.onProgress?.(completed, params.requests.length)
      }
    }))
    
    return { results, errors }
  }, [chat])

  const chatStream = useCallback(async (params: ChatParams, onToken: (providerId: string, token: string) => void) => {
    const provider = state.providers.get(params.providerId)
    if (!provider) throw new Error(`Provider not initialized: ${params.providerId}`)
    
    const config = PROVIDER_CONFIGS[params.providerId]
    const messages = [
      ...(params.systemPrompt ? [{ role: 'system' as const, content: params.systemPrompt }] : []),
      ...params.messages,
    ]
    
    const proxyRes = await fetch('/api/ai/proxy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        provider: params.providerId,
        endpoint: '/chat/completions',
        apiKey: provider.apiKey,
        body: {
          model: params.model,
          messages,
          temperature: params.temperature ?? 0.7,
          max_tokens: params.maxTokens ?? 4096,
          stream: true,
        },
      }),
    })
    
    if (!proxyRes.ok || !proxyRes.body) {
      throw new Error(`Stream failed: ${proxyRes.status}`)
    }
    
    const reader = proxyRes.body.getReader()
    const decoder = new TextDecoder()
    
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '))
      for (const line of lines) {
        const data = line.slice(6)
        if (data === '[DONE]') return
        try {
          const parsed = JSON.parse(data)
          const token = parsed.choices?.[0]?.delta?.content
          if (token) onToken(params.providerId, token)
        } catch {}
      }
    }
  }, [state.providers])

  const agentChat = useCallback(async (params: AgentChatParams): Promise<AgentChatResult> => {
    const conversation: AgentMessage[] = []
    let currentMessage = params.initialMessage
    const maxRounds = params.maxRounds ?? 5
    
    for (let round = 1; round <= maxRounds; round++) {
      const roundOutputs = new Map<string, string>()
      
      for (const agent of params.agents) {
        const messages: ChatMessage[] = [
          { role: 'user', content: currentMessage },
        ]
        
        const result = await chat({
          providerId: agent.providerId,
          model: agent.model,
          messages,
          systemPrompt: agent.systemPrompt,
        })
        
        conversation.push({
          agentId: agent.id,
          agentName: agent.name,
          role: 'assistant',
          content: result.content,
          timestamp: Date.now(),
          round,
        })
        
        roundOutputs.set(agent.id, result.content)
      }
      
      params.onRoundComplete?.(round, roundOutputs)
      
      if (round < maxRounds) {
        const combined = Array.from(roundOutputs.entries())
          .map(([id, content]) => `[${params.agents.find(a => a.id === id)?.name}]: ${content}`)
          .join('\n\n---\n\n')
        currentMessage = `Previous round outputs:\n${combined}\n\nContinue the discussion or provide final synthesis.`
      }
    }
    
    const finalOutput = conversation
      .filter(m => m.round === maxRounds)
      .map(m => `${m.agentName}: ${m.content}`)
      .join('\n\n')
    
    return { conversation, finalOutput }
  }, [chat])

  const agentChatStream = useCallback(async (params: AgentChatParams, onEvent: (event: AgentEvent) => void) => {
    const conversation: AgentMessage[] = []
    let currentMessage = params.initialMessage
    const maxRounds = params.maxRounds ?? 5
    
    for (let round = 1; round <= maxRounds; round++) {
      onEvent({ type: 'round_start', round })
      const roundOutputs = new Map<string, string>()
      
      await Promise.all(params.agents.map(async (agent) => {
        let fullContent = ''
        const messages: ChatMessage[] = [
          { role: 'user', content: currentMessage },
        ]
        
        await chatStream({
          providerId: agent.providerId,
          model: agent.model,
          messages,
          systemPrompt: agent.systemPrompt,
        }, (token) => {
          fullContent += token
          onEvent({ type: 'agent_token', agentId: agent.id, token })
        })
        
        conversation.push({
          agentId: agent.id,
          agentName: agent.name,
          role: 'assistant',
          content: fullContent,
          timestamp: Date.now(),
          round,
        })
        
        roundOutputs.set(agent.id, fullContent)
        onEvent({ type: 'agent_complete', agentId: agent.id, content: fullContent })
      }))
      
      onEvent({ type: 'round_complete', round, outputs: roundOutputs })
      params.onRoundComplete?.(round, roundOutputs)
      
      if (round < maxRounds) {
        const combined = Array.from(roundOutputs.entries())
          .map(([id, content]) => `[${params.agents.find(a => a.id === id)?.name}]: ${content}`)
          .join('\n\n---\n\n')
        currentMessage = `Previous round outputs:\n${combined}\n\nContinue the discussion or provide final synthesis.`
      }
    }
  }, [chatStream])

  const value: MultiAIState = {
    ...state,
    initializeProvider,
    removeProvider,
    setActiveProvider,
    fetchModels,
    chat,
    chatParallel,
    chatStream,
    agentChat,
    agentChatStream,
  }

  return (
    <MultiAIContext.Provider value={value}>
      {children}
    </MultiAIContext.Provider>
  )
}

export function useMultiAI() {
  const ctx = useContext(MultiAIContext)
  if (!ctx) throw new Error('useMultiAI must be used within MultiAIProvider')
  return ctx
}