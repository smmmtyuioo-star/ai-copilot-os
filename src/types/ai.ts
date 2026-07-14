export interface ProviderConfig {
  name: string
  baseUrl: string
  envKey: string
  modelsEndpoint: string
  supportsStreaming: boolean
  supportsParallel: boolean
}

export interface ModelProvider {
  id: string
  name: string
  config: ProviderConfig
  apiKey: string
  models: AIModel[]
  initialized: boolean
}

export interface AIModel {
  id: string
  name: string
  provider: string
  providerId: string
  contextWindow: number
  supportsStreaming: boolean
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  name?: string
  tool_call_id?: string
  tool_calls?: ToolCall[]
}

export interface ToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export interface Agent {
  id: string
  name: string
  providerId: string
  model: string
  systemPrompt: string
  tools?: string[]
  role?: string
}

export interface AgentMessage {
  agentId: string
  agentName: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  round: number
}

export interface WorkflowStep {
  id: string
  type: 'agent' | 'parallel' | 'conditional' | 'loop' | 'tool'
  config: Record<string, any>
  next?: string[]
}