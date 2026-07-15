import { NextRequest } from 'next/server'
import { ok, fail, serverError } from '@/lib/api-utils'
import { localStore } from '@/lib/storage'

export async function POST(request: NextRequest) {
  try {
    const { type, ids } = await request.json()
    if (!type) return fail('Export type is required (conversations, memories, agents, settings, all)')

    const exportData: Record<string, any> = {}

    if (type === 'conversations' || type === 'all') {
      exportData.conversations = localStore.conversations.items
      exportData.messages = localStore.messages.items
    }
    if (type === 'memories' || type === 'all') {
      exportData.memories = localStore.memories.items
    }
    if (type === 'agents' || type === 'all') {
      exportData.agents = localStore.agents.items
      exportData.apiKeys = localStore.apiKeys.items
    }
    if (type === 'settings' || type === 'all') {
      exportData.mcpEndpoints = localStore.mcpEndpoints.items
      exportData.profile = localStore.profile.items
    }

    if (Object.keys(exportData).length === 0) return fail('No data found for export')

    return ok({
      exportedAt: new Date().toISOString(),
      type,
      data: exportData,
      summary: Object.entries(exportData).map(([k, v]) => `${k}: ${(v as any[]).length} items`).join(', '),
    }, 'Export generated')
  } catch (e) { return serverError(e) }
}
