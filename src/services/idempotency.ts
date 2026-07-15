import { isWriteTool, getWriteTools } from '@/services/tools'
import type { ToolName } from '@/services/tools'

export interface WriteActionRequest {
  tool: ToolName
  args: Record<string, any>
  summary: string
}

export interface IdempotencyConfig {
  autoConfirmWriteTools?: boolean
  writeToolConfirmations?: Record<string, boolean>
}

const WRITE_SUMMARIES: Record<string, (args: Record<string, any>) => string> = {
  github_action: (args) => {
    const action = String(args.action || '')
    switch (action) {
      case 'create-repo': return `Create GitHub repository "${args.name}"`
      case 'create-file': return `Create file "${args.path}" in ${args.repo}`
      case 'list-repos': return `List GitHub repositories (read-only)`
      case 'get-repo': return `Get repository info for ${args.repo} (read-only)`
      case 'list-org-repos': return `List repos for org ${args.owner} (read-only)`
      case 'user-info': return `Get GitHub user info (read-only)`
      default: return `GitHub action: ${action}`
    }
  },
  execute_code: (args) => {
    const codePreview = String(args.code || '').slice(0, 80)
    return `Execute code: "${codePreview}${codePreview.length >= 80 ? '...' : ''}"`
  },
}

function isReadOnlyGitHubAction(action: string): boolean {
  return ['list-repos', 'get-repo', 'list-org-repos', 'user-info'].includes(action)
}

export function getWriteActionSummary(tool: ToolName, args: Record<string, any>): string | null {
  if (!isWriteTool(tool)) return null

  if (tool === 'github_action' && isReadOnlyGitHubAction(String(args.action || ''))) {
    return null
  }

  const summarizer = WRITE_SUMMARIES[tool]
  if (summarizer) return summarizer(args)

  return `Execute ${tool} with arguments: ${JSON.stringify(args).slice(0, 100)}`
}

export function shouldConfirmTool(tool: ToolName, args: Record<string, any>, config?: IdempotencyConfig): boolean {
  if (config?.autoConfirmWriteTools) return false
  if (config?.writeToolConfirmations?.[tool]) return false

  if (!isWriteTool(tool)) return false

  if (tool === 'github_action' && isReadOnlyGitHubAction(String(args.action || ''))) {
    return false
  }

  return true
}

export function getWriteToolsNeedingConfirmation(argsMap: Record<string, Record<string, any>>, config?: IdempotencyConfig): WriteActionRequest[] {
  const requests: WriteActionRequest[] = []
  for (const [tool, args] of Object.entries(argsMap)) {
    if (shouldConfirmTool(tool as ToolName, args, config)) {
      const summary = getWriteActionSummary(tool as ToolName, args)
      if (summary) {
        requests.push({ tool: tool as ToolName, args, summary })
      }
    }
  }
  return requests
}
