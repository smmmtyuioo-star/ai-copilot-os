import { env } from '@/config/env'
import { executeTool, getToolDefinitions } from '@/services/tools'
import { shouldConfirmTool, getWriteActionSummary } from '@/services/idempotency'
import { recordToolCall } from '@/services/telemetry'
import type { ToolExecutionContext, ToolName } from '@/services/tools'

const PROVIDERS: Record<string, { baseUrl: string; key: () => string; models: string[] }> = {
  groq: { baseUrl: 'https://api.groq.com/openai/v1', key: () => env.ai.groqKey, models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'] },
  cerebras: { baseUrl: 'https://api.cerebras.ai/v1', key: () => env.ai.cerebrasKey, models: ['llama-3.3-70b', 'llama-3.1-70b'] },
  fireworks: { baseUrl: 'https://api.fireworks.ai/inference/v1', key: () => env.ai.fireworksKey, models: ['accounts/fireworks/models/llama-v3p3-70b-instruct', 'accounts/fireworks/models/llama-v3p1-70b-instruct'] },
  deepseek: { baseUrl: 'https://api.deepseek.com/v1', key: () => env.ai.deepseekKey, models: ['deepseek-chat', 'deepseek-coder'] },
  mistral: { baseUrl: 'https://api.mistral.ai/v1', key: () => env.ai.mistralKey, models: ['mistral-large', 'mistral-medium', 'mistral-small'] },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', key: () => env.ai.openrouterKey, models: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.3-70b-instruct', 'google/gemini-pro'] },
  cloudflare: { baseUrl: `https://api.cloudflare.com/client/v4/accounts/${env.ai.cloudflareAccountId}/ai/run`, key: () => env.ai.cloudflareApiToken, models: ['@cf/meta/llama-3.3-70b-instruct', '@cf/meta/llama-3.1-8b-instruct', '@cf/mistral/mistral-7b-instruct-v0.1', '@cf/deepseek/deepseek-r1-distill-qwen-32b'] },
}

const FALLBACK_CHAIN = ['groq', 'cerebras', 'fireworks', 'deepseek', 'mistral', 'openrouter', 'cloudflare']

const DEFAULT_SYSTEM_PROMPT = `You are AI Copilot OS — a full-stack AI engineering assistant. You have access to tools you can call to search the web, fetch URLs, perform GitHub actions, check URL safety, and search user memories.

When you need current information, code from GitHub, or user-specific context, use the appropriate tool instead of guessing. After getting tool results, use them to produce your answer.

Be concise, accurate, and thorough. Never refuse a technical challenge — figure it out step by step.`

function detectProvider(model: string): string | null {
  if (env.ai.groqKey) return 'groq'
  if (model.startsWith('gpt-') || model.startsWith('claude-')) return 'openrouter'
  if (['llama-', 'mixtral-', 'gemma-'].some(p => model.startsWith(p))) return 'groq'
  if (model.startsWith('deepseek-')) return 'deepseek'
  if (model.startsWith('mistral-')) return 'mistral'
  if (model.startsWith('accounts/')) return 'fireworks'
  if (model.startsWith('@cf/')) return 'cloudflare'
  return null
}

export interface AgentLoopConfig {
  messages: { role: string; content: string }[]
  tools: ToolName[]
  model?: string
  temperature?: number
  maxTokens?: number
  userId?: string
  maxTurns?: number
  systemPrompt?: string
}

export interface AgentLoopResult {
  success: boolean
  content: string
  turns: number
  toolCalls: number
  error?: string
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

    const body: any = {
      model: modelToUse,
      messages: [{ role: 'system', content: options.systemPrompt || DEFAULT_SYSTEM_PROMPT }, ...messages],
      stream: false,
      max_tokens: options.maxTokens ?? env.ai.maxTokens,
      temperature: options.temperature ?? env.ai.temperature,
    }
    if (options.tools?.length) body.tools = options.tools

    try {
      const response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30000),
      })
      if (!response.ok) {
        if (response.status === 429 || response.status >= 500) continue
        return null
      }
      return await response.json()
    } catch {
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

export async function runAgentLoop(config: AgentLoopConfig): Promise<AgentLoopResult> {
  const { messages, tools, model, temperature, maxTokens, userId, maxTurns = 10, systemPrompt } = config
  const sessionId = `agent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
  const modelToUse = model || env.ai.defaultModel
  const toolDefinitions = getToolDefinitions(tools as string[])
  const context: ToolExecutionContext = { userId: userId || 'anonymous' }
  const currentMessages: any[] = [...messages]
  let totalToolCalls = 0
  let textOnlyRounds = 0
  const MAX_TEXT_ONLY_ROUNDS = 2

  for (let turn = 0; turn < maxTurns; turn++) {
    const data = await callLlm(currentMessages, modelToUse, {
      temperature, maxTokens, tools: toolDefinitions, systemPrompt,
    })

    if (!data) {
      return { success: false, content: '', turns: turn + 1, toolCalls: totalToolCalls, error: 'All providers failed' }
    }

    const choice = data.choices?.[0]
    const message = choice?.message
    if (!message) {
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

        if (shouldConfirmTool(toolCall.function.name as ToolName, args)) {
          const summary = getWriteActionSummary(toolCall.function.name as ToolName, args)
          recordToolCall({
            timestamp: new Date().toISOString(), tool: toolCall.function.name, userId: userId || 'anonymous',
            sessionId, args, latencyMs: Date.now() - toolStart, success: true,
            resultLength: 0,
          })
          currentMessages.push({
            role: 'tool',
            tool_call_id: toolCall.id,
            content: `[ACTION REQUIRES CONFIRMATION] ${summary || toolCall.function.name}. The user must approve this action before it can be executed. Please ask the user to confirm.`,
          })
          continue
        }

        const result = await executeTool(toolCall.function.name, args, context)

        const success = !result.startsWith('Error:') && !result.startsWith('Tool execution error:')
        recordToolCall({
          timestamp: new Date().toISOString(), tool: toolCall.function.name, userId: userId || 'anonymous',
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
        return {
          success: true,
          content: response,
          turns: turn + 1,
          toolCalls: totalToolCalls,
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
  return {
    success: true,
    content: finalMsg?.content || 'Task completed after maximum turns.',
    turns: maxTurns,
    toolCalls: totalToolCalls,
  }
}
