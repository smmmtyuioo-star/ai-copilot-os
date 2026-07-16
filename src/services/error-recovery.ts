import { executeTool } from '@/services/tools'
import type { ToolName, ToolExecutionContext } from '@/services/tools'

export interface RecoveryConfig {
  maxRetries?: number
  retryDelayMs?: number
  useFallbackTools?: boolean
}

export interface RecoveryResult {
  success: boolean
  content: string
  tool: ToolName
  fallbackUsed?: ToolName
  retries: number
  partialData: boolean
}

const FALLBACK_MAP: Partial<Record<ToolName, ToolName>> = {
  web_search: 'fetch_url',
}

function getFallbackTool(tool: ToolName): ToolName | undefined {
  return FALLBACK_MAP[tool]
}

const PARTIAL_DATA_PREFIX = '[PARTIAL RESULT]'

export function isPartialResult(content: string): boolean {
  return content.startsWith(PARTIAL_DATA_PREFIX)
}

export async function executeWithRecovery(
  tool: ToolName,
  args: Record<string, any>,
  context: ToolExecutionContext,
  config: RecoveryConfig = {}
): Promise<RecoveryResult> {
  const { maxRetries = 1, retryDelayMs = 1000, useFallbackTools = true } = config
  let lastError = ''
  let attempts = 0

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    attempts++
    try {
      const result = await executeTool(tool, { ...args, timeout: args.timeout || 8000 }, context)

      if (result.startsWith('Error:') || result.startsWith('Tool execution error:')) {
        lastError = result
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, retryDelayMs))
        }
        continue
      }

      const isPartial = !result || result === '(no output)' || result === 'No results found.'
      return {
        success: true,
        content: isPartial ? `${PARTIAL_DATA_PREFIX} ${tool} returned limited data. ${result || 'No output.'}` : result,
        tool,
        retries: attempt,
        partialData: isPartial,
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Unknown error'
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, retryDelayMs * (attempt + 1)))
      }
    }
  }

  if (useFallbackTools) {
    const fallbackTool = getFallbackTool(tool)
    if (fallbackTool) {
      let fallbackArgs = args
      if (tool === 'web_search' && fallbackTool === 'fetch_url') {
        const query = String(args.query || '')
        fallbackArgs = { url: `https://www.google.com/search?q=${encodeURIComponent(query)}` }
      }

      try {
        const result = await executeTool(fallbackTool, fallbackArgs, context)
        if (!result.startsWith('Error:')) {
          return {
            success: true,
            content: `${PARTIAL_DATA_PREFIX} ${tool} failed (${lastError}). Used ${fallbackTool} as fallback.\n\n${result}`,
            tool,
            fallbackUsed: fallbackTool,
            retries: attempts,
            partialData: true,
          }
        }
      } catch (e) { console.error(`Error-recovery fallback tool ${fallbackTool} failed:`, e) }
    }
  }

  return {
    success: false,
    content: `Could not retrieve data from ${tool} after ${attempts} attempt(s). ${lastError}. Proceeding with available information.`,
    tool,
    retries: attempts,
    partialData: true,
  }
}
