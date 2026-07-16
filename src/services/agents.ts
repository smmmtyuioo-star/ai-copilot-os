import { getSupabase } from '@/database/client'
import { localStore, hasSupabase } from '@/lib/storage'
import type { Agent, AgentRole } from '@/types'
import { generateId, parseError } from '@/lib/utils'
import { env } from '@/config/env'

const AGENT_DEFAULTS: Record<AgentRole, { name: string; prompt: string; tools: string[] }> = {
  'request-analyzer': {
    name: 'Request Analyzer',
    prompt: 'Analyze user requests and extract requirements, constraints, and success criteria.',
    tools: ['analyze-request', 'extract-requirements'],
  },
  'requirement-planner': {
    name: 'Requirement Planner',
    prompt: 'Create detailed implementation plans from requirements.',
    tools: ['create-plan', 'estimate-effort'],
  },
  'architecture-designer': {
    name: 'Architecture Designer',
    prompt: 'Design system architecture following clean architecture and SOLID principles.',
    tools: ['design-architecture', 'validate-design'],
  },
  'research': {
    name: 'Research Agent',
    prompt: 'Research topics, gather information, and provide comprehensive analysis.',
    tools: ['web-search', 'read-url', 'analyze-document'],
  },
  'code-generator': {
    name: 'Code Generator',
    prompt: 'Generate production-quality code following TypeScript and project standards.',
    tools: ['generate-code', 'refactor-code'],
  },
  'api-builder': {
    name: 'API Builder',
    prompt: 'Design and implement RESTful API endpoints with validation and documentation.',
    tools: ['design-api', 'generate-routes', 'validate-api'],
  },
  'test-generator': {
    name: 'Test Generator',
    prompt: 'Write comprehensive tests covering unit, integration, and edge cases.',
    tools: ['generate-tests', 'run-tests'],
  },
  'security-reviewer': {
    name: 'Security Reviewer',
    prompt: 'Review code for security vulnerabilities and enforce security best practices.',
    tools: ['scan-vulnerabilities', 'audit-dependencies', 'validate-inputs'],
  },
  'performance-optimizer': {
    name: 'Performance Optimizer',
    prompt: 'Optimize code for performance, identify bottlenecks, and suggest improvements.',
    tools: ['analyze-performance', 'optimize-bundle', 'profile-execution'],
  },
  'final-reviewer': {
    name: 'Final Reviewer',
    prompt: 'Perform final review of all changes against definition of done criteria.',
    tools: ['review-code', 'check-documentation', 'verify-standards'],
  },
}

export function getAgentDefaults(role: AgentRole) {
  return AGENT_DEFAULTS[role]
}

export async function createAgent(userId: string, role: AgentRole, model?: string): Promise<Agent> {
  const defaults = AGENT_DEFAULTS[role]
  const agent: Agent = {
    id: generateId(),
    user_id: userId,
    name: defaults.name,
    role,
    model: model || 'llama-3.3-70b-versatile',
    system_prompt: defaults.prompt,
    tools: defaults.tools,
    status: 'idle',
    created_at: new Date().toISOString(),
  }
  if (hasSupabase) {
    const supabase = getSupabase()
    if (supabase) {
      const { error } = await supabase.from('agents').insert(agent)
      if (error) throw new Error(error.message)
      return agent
    }
  }
  localStore.agents.add({ id: agent.id, name: agent.name, role: agent.role, model: agent.model, systemPrompt: agent.system_prompt, tools: agent.tools })
  return agent
}

export async function getAgents(userId: string): Promise<Agent[]> {
  if (hasSupabase) {
    const supabase = getSupabase()
    if (supabase) {
      const { data, error } = await supabase.from('agents').select('*').eq('user_id', userId).order('created_at', { ascending: true })
      if (!error && data) return data
    }
  }
  return localStore.agents.items.map(a => ({
    id: a.id, user_id: userId, name: a.name, role: a.role as AgentRole,
    model: a.model, system_prompt: a.systemPrompt, tools: a.tools,
    status: 'idle' as const, created_at: '',
  }))
}

export async function deleteAgent(id: string): Promise<void> {
  if (hasSupabase) {
    const supabase = getSupabase()
    if (supabase) { await supabase.from('agents').delete().eq('id', id); return }
  }
  localStore.agents.remove(id)
}

export async function executeAgentPipeline(
  userId: string,
  request: string,
  onStatus?: (agent: string, status: string) => void,
): Promise<{ success: boolean; output?: string; error?: string }> {
  try {
    const agents = await getAgents(userId)
    if (agents.length === 0) {
      return { success: false, error: 'No agents configured. Create agents first.' }
    }

    let currentRequest = request
    for (const agent of agents) {
      onStatus?.(agent.name, 'running')

      const response = await fetch(`${env.app.url}/api/ai/agent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent, request: currentRequest }),
      })

      if (!response.ok) {
        onStatus?.(agent.name, 'error')
        return { success: false, error: `Agent ${agent.name} failed` }
      }

      const result = await response.json()
      currentRequest = result.output || currentRequest
      onStatus?.(agent.name, 'completed')
    }

    return { success: true, output: currentRequest }
  } catch (err) {
    return { success: false, error: parseError(err) }
  }
}
