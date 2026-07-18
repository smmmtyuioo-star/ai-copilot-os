import { env } from '@/config/env'
import { executeTool, getToolDefinitions } from '@/services/tools'
import { shouldConfirmTool, getWriteActionSummary } from '@/services/idempotency'
import { recordToolCall } from '@/services/telemetry'
import { connectMCPEndpoint, executeMCPTool } from '@/services/mcp'
import { emit, Events } from '@/services/event-bus'
import { recall, addMemory } from '@/services/memory'
import { checkPermission } from '@/services/permission-gate'
import { buildSystemPrompt, PromptMode } from '@/lib/prompt-builder'
import { parseEditBlocks } from '@/lib/edit-blocks'
import type { ToolExecutionContext, ToolName } from '@/services/tools'

const PROVIDERS: Record<string, { baseUrl: string; key: () => string; models: string[] }> = {
  groq: { baseUrl: 'https://api.groq.com/openai/v1', key: () => env.ai.groqKey, models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'] },
  mistral: { baseUrl: 'https://api.mistral.ai/v1', key: () => env.ai.mistralKey, models: ['mistral-medium', 'mistral-small'] },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', key: () => env.ai.openrouterKey, models: ['openai/gpt-4o', 'meta-llama/llama-3.3-70b-instruct'] },
  nvidia: { baseUrl: 'https://integrate.api.nvidia.com/v1', key: () => env.ai.nvidiaKey, models: ['nvidia/nemotron-3-ultra-550b-a55b', 'deepseek-ai/deepseek-v4-flash'] },
  cloudflare: { baseUrl: `https://api.cloudflare.com/client/v4/accounts/${env.ai.cloudflareAccountId}/ai/run`, key: () => env.ai.cloudflareApiToken, models: ['@cf/meta/llama-3.1-8b-instruct-fp8', '@cf/meta/llama-3.2-3b-instruct'] },
}

const FALLBACK_CHAIN = ['groq', 'mistral', 'nvidia', 'openrouter', 'cloudflare']

const MODEL_TO_PROVIDER: Record<string, string> = {}
for (const [provider, config] of Object.entries(PROVIDERS)) {
  for (const model of config.models) {
    MODEL_TO_PROVIDER[model] = provider
  }
}

function detectProvider(model: string): string | null {
  return MODEL_TO_PROVIDER[model] || null
}

export interface AgentLoopConfig {
  messages: { role: string; content: string }[]
  tools: ToolName[]
  mcpEndpoints?: any[]
  model?: string
  temperature?: number
  maxTokens?: number
  userId?: string
  maxTurns?: number
  systemPrompt?: string
  mode?: PromptMode
}

export interface PendingConfirmation {
  sessionId: string
  tool: string
  args: Record<string, any>
  summary: string
  messages: any[]
  model: string
  options: { temperature?: number; maxTokens?: number; systemPrompt?: string }
}

export interface AgentLoopResult {
  success: boolean
  content: string
  turns: number
  toolCalls: number
  error?: string
  needsConfirmation?: PendingConfirmation
  editResults?: { filePath: string; success: boolean; message: string }[]
}

async function callLlm(
  messages: { role: string; content: string }[],
  model: string,
  options: { temperature?: number; maxTokens?: number; tools?: any[]; systemPrompt?: string }
): Promise<any | null> {
  const modelToUse = model || env.ai.defaultModel
  const providerName = detectProvider(modelToUse) || 'groq'
  const startIndex = FALLBACK_CHAIN.indexOf(providerName)
  const providersToTry = FALLBACK_CHAIN.slice(startIndex >= 0 ? startIndex : 0)

  for (const name of providersToTry) {
    const provider = PROVIDERS[name]
    if (!provider) continue
    const apiKey = provider.key()
    if (!apiKey) continue

    const isCloudflare = name === 'cloudflare'
    const body: any = isCloudflare
      ? {
          messages: [{ role: 'system', content: options.systemPrompt || '' }, ...messages],
          max_tokens: options.maxTokens ?? env.ai.maxTokens,
          temperature: options.temperature ?? env.ai.temperature,
        }
      : {
          model: modelToUse,
          messages: [{ role: 'system', content: options.systemPrompt || '' }, ...messages],
          stream: false,
          max_tokens: options.maxTokens ?? env.ai.maxTokens,
          temperature: options.temperature ?? env.ai.temperature,
        }
    if (!isCloudflare && options.tools?.length) body.tools = options.tools

    try {
      const apiUrl = isCloudflare ? `${provider.baseUrl}/${modelToUse}` : `${provider.baseUrl}/chat/completions`
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      })
      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) continue
        return null
      }
      const json = await response.json()
      if (isCloudflare) {
        return { choices: [{ message: { role: 'assistant', content: json.result?.response || '' } }] }
      }
      return json
    } catch (err) {
      console.error(`[agent-loop] Provider ${name} failed:`, err instanceof Error ? err.message : String(err))
      continue
    }
  }
  return null
}

function hasToolResults(messages: any[]): boolean {
  return messages.some(m => m.role === 'tool' && m.content)
}

function responseUsesToolResults(response: string, toolResults: string[]): boolean {
  if (toolResults.length === 0) return true
  const lower = response.toLowerCase()
  return toolResults.some(r => {
    const snippet = r.toLowerCase().slice(0, 50)
    return snippet.length > 10 && lower.includes(snippet.slice(0, 30))
  })
}

function isCompleteResponse(response: string): boolean {
  const complete = [
    /^(here'?s?\s+(the|my|your|a)\s|i'?ve\s+(created|built|written|finished|completed|added|implemented)|task\s+(complete|done|finished)|summary:|in\s+(conclusion|summary))/i,
    /\b(i have|here are|the (result|output|answer) (is|are))\b/i,
  ]
  return complete.some(p => p.test(response))
}

const pendingConfirmations = new Map<string, PendingConfirmation>()

export function getPendingConfirmation(sessionId: string): PendingConfirmation | undefined {
  return pendingConfirmations.get(sessionId)
}

export function removePendingConfirmation(sessionId: string): void {
  pendingConfirmations.delete(sessionId)
}

export async function resumeAgentLoop(
  sessionId: string,
  approved: boolean,
  config: AgentLoopConfig
): Promise<AgentLoopResult> {
  const pending = pendingConfirmations.get(sessionId)
  if (!pending) {
    return { success: false, content: '', turns: 0, toolCalls: 0, error: 'No pending confirmation found' }
  }
  pendingConfirmations.delete(sessionId)

  const messages = pending.messages
  const toolCall = messages[messages.length - 1]?.tool_calls?.[0]
  if (!toolCall) {
    return { success: false, content: '', turns: 0, toolCalls: 0, error: 'No pending tool call found' }
  }

  if (approved) {
    let args: Record<string, any> = {}
    try { args = JSON.parse(toolCall.function.arguments) } catch { args = {} }

    const context: ToolExecutionContext = { userId: config.userId || 'anonymous' }
    let result = ''
    const mcpToolMap = new Map<string, string>()

    if (config.mcpEndpoints) {
      for (const ep of config.mcpEndpoints) {
        const connection = await connectMCPEndpoint(ep)
        if (connection.success && connection.tools) {
          for (const t of connection.tools) {
            const mcpToolName = `mcp_${ep.id}_${t.name}`.replace(/[^a-zA-Z0-9_-]/g, '_')
            mcpToolMap.set(mcpToolName, ep.id)
          }
        }
      }
    }

    const mcpEndpointId = mcpToolMap.get(toolCall.function.name)
    if (mcpEndpointId) {
      const originalToolName = toolCall.function.name.replace(`mcp_${mcpEndpointId}_`, '')
      const mcpResult = await executeMCPTool(mcpEndpointId, originalToolName, args)
      if (mcpResult.success && mcpResult.data?.content && Array.isArray(mcpResult.data.content)) {
        result = mcpResult.data.content.map((c: any) => c.text || JSON.stringify(c)).join('\n')
      } else if (mcpResult.success) {
        result = JSON.stringify(mcpResult.data)
      } else {
        result = `Error: MCP tool execution failed: ${mcpResult.error}`
      }
    } else {
      result = await executeTool(toolCall.function.name, args, context)
    }

    messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result })
  } else {
    messages.push({ role: 'tool', tool_call_id: toolCall.id, content: '[USER DENIED] The user denied this action.' })
  }

  const runConfig: AgentLoopConfig = {
    messages,
    tools: config.tools,
    mcpEndpoints: config.mcpEndpoints,
    model: pending.model,
    temperature: pending.options.temperature,
    maxTokens: pending.options.maxTokens,
    userId: config.userId,
    maxTurns: config.maxTurns,
    systemPrompt: pending.options.systemPrompt,
  }

  return runAgentLoop(runConfig)
}

export async function runAgentLoop(config: AgentLoopConfig): Promise<AgentLoopResult> {
  const { messages, tools, mcpEndpoints, model, temperature, maxTokens, userId, maxTurns = 10, systemPrompt, mode = 'chat' } = config
  const sessionId = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const modelToUse = model || env.ai.defaultModel
  const uid = userId || 'anonymous'

  emit(Events.AGENT_STARTED, { sessionId, userId: uid, model: modelToUse, mode })

  // Build system prompt using the layering system (ref: Aider prompt architecture)
  const userMessages = messages.filter(m => m.role === 'user')
  const lastUserMessage = userMessages[userMessages.length - 1]?.content || ''

  // Recall relevant memories for context
  let memoryContext = ''
  if (lastUserMessage) {
    const memories = recall(uid, lastUserMessage, 3)
    if (memories.length > 0) {
      memoryContext = `\n<relevant_memories>\n${memories.map(m => `- ${m.content}`).join('\n')}\n</relevant_memories>`
    }
  }

  const resolvedSystemPrompt = systemPrompt || buildSystemPrompt(mode, {
    extraInstructions: memoryContext,
    platform: 'web',
  })

  let toolDefinitions = getToolDefinitions(tools as string[])
  const mcpToolMap = new Map<string, string>()

  if (mcpEndpoints && mcpEndpoints.length > 0) {
    for (const ep of mcpEndpoints) {
      if (ep.status !== 'active') continue
      const connection = await connectMCPEndpoint(ep)
      if (connection.success && connection.tools) {
        for (const t of connection.tools) {
          const mcpToolName = `mcp_${ep.id}_${t.name}`.replace(/[^a-zA-Z0-9_-]/g, '_')
          mcpToolMap.set(mcpToolName, ep.id)
          toolDefinitions.push({
            type: 'function',
            function: {
              name: mcpToolName,
              description: t.description || `MCP Tool: ${t.name}`,
              parameters: (t.inputSchema || { type: 'object', properties: {}, required: [] }) as any,
            }
          })
        }
      } else {
        console.error(`MCP connect failed for ${ep.name}:`, connection.error)
      }
    }
  }

  const context: ToolExecutionContext = { userId: uid }
  const currentMessages: any[] = [...messages]
  let totalToolCalls = 0
  let textOnlyRounds = 0
  const MAX_TEXT_ONLY_ROUNDS = 2
  const allEditResults: AgentLoopResult['editResults'] = []

  for (let turn = 0; turn < maxTurns; turn++) {
    const data = await callLlm(currentMessages, modelToUse, {
      temperature, maxTokens, tools: toolDefinitions, systemPrompt: resolvedSystemPrompt,
    })

    if (!data) {
      emit(Events.AGENT_FINISHED, { sessionId, userId: uid, success: false, error: 'All providers failed' })
      return { success: false, content: '', turns: turn + 1, toolCalls: totalToolCalls, error: 'All providers failed' }
    }

    const choice = data.choices?.[0]
    const message = choice?.message
    if (!message) {
      emit(Events.AGENT_FINISHED, { sessionId, userId: uid, success: false, error: 'Unexpected response format' })
      return { success: false, content: '', turns: turn + 1, toolCalls: totalToolCalls, error: 'Unexpected response format' }
    }

    if (message.tool_calls && message.tool_calls.length > 0) {
      textOnlyRounds = 0
      currentMessages.push({
        role: 'assistant',
        content: message.content || null,
        tool_calls: message.tool_calls,
      })

      for (const toolCall of message.tool_calls) {
        totalToolCalls++
        let args: Record<string, any> = {}
        try { args = JSON.parse(toolCall.function.arguments) } catch { args = {} }
        const toolStart = Date.now()

        // Permission gate check
        const perm = checkPermission(toolCall.function.name as ToolName)
        if (perm === 'deny') {
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `[PERMISSION DENIED] The tool "${toolCall.function.name}" is not permitted in the current mode.`,
          })
          continue
        }

        if (perm === 'ask' || shouldConfirmTool(toolCall.function.name as ToolName, args)) {
          const summary = getWriteActionSummary(toolCall.function.name as ToolName, args) || `${toolCall.function.name}`
          const pending: PendingConfirmation = {
            sessionId,
            tool: toolCall.function.name,
            args,
            summary,
            messages: currentMessages,
            model: modelToUse,
            options: { temperature, maxTokens, systemPrompt: resolvedSystemPrompt },
          }
          pendingConfirmations.set(sessionId, pending)
          emit(Events.TOOL_CALLED, { sessionId, userId: uid, tool: toolCall.function.name, args, status: 'pending' })
          return {
            success: true,
            content: '',
            turns: turn + 1,
            toolCalls: totalToolCalls,
            needsConfirmation: pending,
          }
        }

        emit(Events.TOOL_CALLED, { sessionId, userId: uid, tool: toolCall.function.name, args, status: 'executing' })

        let result = ''
        const mcpEndpointId = mcpToolMap.get(toolCall.function.name)
        if (mcpEndpointId) {
          const originalToolName = toolCall.function.name.replace(`mcp_${mcpEndpointId}_`, '')
          const mcpResult = await executeMCPTool(mcpEndpointId, originalToolName, args)
          if (mcpResult.success && mcpResult.data?.content && Array.isArray(mcpResult.data.content)) {
            result = mcpResult.data.content.map((c: any) => c.text || JSON.stringify(c)).join('\n')
          } else if (mcpResult.success) {
            result = JSON.stringify(mcpResult.data)
          } else {
            result = `Error: MCP tool execution failed: ${mcpResult.error}`
          }
        } else {
          result = await executeTool(toolCall.function.name, args, context)
        }

        const success = !result.startsWith('Error:') && !result.startsWith('Tool execution error:')
        recordToolCall({
          timestamp: new Date().toISOString(), tool: toolCall.function.name, userId: uid,
          sessionId, args, latencyMs: Date.now() - toolStart, success,
          resultLength: result.length, error: success ? undefined : result,
        })

        currentMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: result,
        })
      }
    } else {
      const response = message.content || ''

      // Parse and record SEARCH/REPLACE blocks from the response
      const editBlocks = parseEditBlocks(response)
      if (editBlocks.length > 0) {
        for (const block of editBlocks) {
          allEditResults.push({
            filePath: block.path,
            success: true,
            message: `SEARCH/REPLACE block for ${block.path} parsed. Execute via edit tool to apply.`,
          })
        }
      }

      const toolResults = currentMessages
        .filter(m => m.role === 'tool')
        .map(m => m.content as string)

      if (hasToolResults(currentMessages) && !responseUsesToolResults(response, toolResults) && textOnlyRounds < MAX_TEXT_ONLY_ROUNDS) {
        textOnlyRounds++
        currentMessages.push({
          role: 'system',
          content: `The tool results above contain data you requested. Use them to answer the user's question instead of relying on prior knowledge. Reference specific numbers, facts, or code from the results.`,
        })
        continue
      }

      if (isCompleteResponse(response) || !hasToolResults(currentMessages) || textOnlyRounds >= MAX_TEXT_ONLY_ROUNDS) {
        // Save to memory
        const allInteractions = currentMessages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => `${m.role}: ${m.content}`)
          .join('\n')

        const importance = allEditResults.length > 0 ? 0.8 : 0.3

        addMemory(
          uid,
          'interaction',
          allInteractions.slice(0, 2000),
          ['conversation', mode, ...allEditResults.filter(r => r.success).map(r => r.filePath)],
          importance,
        )

        emit(Events.MESSAGE_SENT, { sessionId, userId: uid, content: response.slice(0, 100), turn: turn + 1 })
        emit(Events.AGENT_FINISHED, { sessionId, userId: uid, success: true, turns: turn + 1 })

        return {
          success: true,
          content: response,
          turns: turn + 1,
          toolCalls: totalToolCalls,
          editResults: allEditResults.length > 0 ? allEditResults : undefined,
        }
      }

      textOnlyRounds++
      currentMessages.push({
        role: 'system',
        content: `Review the information you gathered above. If you have enough data, provide a complete answer. If you need more information, call a tool to get it. Do not make up facts that were not provided.`,
      })
    }
  }

  const finalMsg = currentMessages[currentMessages.length - 1]
  emit(Events.AGENT_FINISHED, { sessionId, userId: uid, success: true, turns: maxTurns })

  return {
    success: true,
    content: finalMsg?.content || 'Task completed after maximum turns.',
    turns: maxTurns,
    toolCalls: totalToolCalls,
    editResults: allEditResults.length > 0 ? allEditResults : undefined,
  }
}
