export interface User {
  id: string
  email: string
  name: string
  avatar_url?: string
  created_at: string
  updated_at: string
}

export interface Session {
  user: User
  access_token: string
  refresh_token: string
  expires_at: number
}

export interface Conversation {
  id: string
  user_id: string
  title: string
  model: string
  created_at: string
  updated_at: string
}

export interface Message {
  id: string
  conversation_id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  metadata?: Record<string, unknown>
  created_at: string
}

export interface Workflow {
  id: string
  user_id: string
  name: string
  description: string
  nodes: WorkflowNode[]
  triggers: WorkflowTrigger[]
  status: 'draft' | 'active' | 'paused' | 'archived'
  created_at: string
  updated_at: string
}

export interface WorkflowNode {
  id: string
  type: 'action' | 'condition' | 'loop' | 'delay' | 'parallel'
  config: Record<string, unknown>
  next: string[]
}

export interface WorkflowTrigger {
  type: 'webhook' | 'schedule' | 'event' | 'manual'
  config: Record<string, unknown>
}

export interface Agent {
  id: string
  user_id: string
  name: string
  role: AgentRole
  model: string
  system_prompt: string
  tools: string[]
  status: 'idle' | 'running' | 'error'
  created_at: string
}

export type AgentRole =
  | 'request-analyzer'
  | 'requirement-planner'
  | 'architecture-designer'
  | 'research'
  | 'code-generator'
  | 'api-builder'
  | 'test-generator'
  | 'security-reviewer'
  | 'performance-optimizer'
  | 'final-reviewer'

export interface Connector {
  id: string
  user_id: string
  name: string
  provider: string
  config: Record<string, unknown>
  status: 'connected' | 'disconnected' | 'error'
  created_at: string
}

export interface Plugin {
  id: string
  name: string
  version: string
  description: string
  author: string
  verified: boolean
  config_schema: Record<string, unknown>
}

export interface MCPEndpoint {
  id: string
  user_id: string
  name: string
  url: string
  protocol: string
  status: 'active' | 'inactive' | 'error'
  created_at: string
}

export interface ApiKey {
  id: string
  user_id: string
  name: string
  key: string
  permissions: string[]
  created_at: string
  expires_at?: string
}

export interface MemoryEntry {
  id: string
  user_id: string
  type: 'short-term' | 'long-term'
  content: string
  embedding?: number[]
  metadata: Record<string, unknown>
  created_at: string
}

export interface AnalyticsEvent {
  id: string
  user_id: string
  event: string
  properties: Record<string, unknown>
  timestamp: string
}

export interface AuditLog {
  id: string
  user_id: string
  action: string
  resource: string
  details: Record<string, unknown>
  ip_address: string
  created_at: string
}

export type Theme = 'light' | 'dark' | 'system'

export interface AppConfig {
  theme: Theme
  language: string
  notifications: boolean
  ai_model: string
  ai_temperature: number
  ai_max_tokens: number
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
