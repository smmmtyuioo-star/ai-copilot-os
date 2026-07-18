import { NextRequest, NextResponse } from 'next/server'
import { ok, fail, serverError } from '@/lib/api-utils'
import { getServerStore } from '@/lib/server-store'

export async function POST(request: NextRequest) {
  try {
    const { type } = await request.json()
    if (!type) return fail('Export type is required (conversations, memories, agents, settings, all)')

    const store = getServerStore()
    const exportData: Record<string, any> = {}

    if (type === 'conversations' || type === 'all') {
      exportData.conversations = store.get('conversations')
      exportData.messages = store.get('messages')
    }
    if (type === 'memories' || type === 'all') {
      exportData.memories = store.get('memories')
    }
    if (type === 'agents' || type === 'all') {
      exportData.agents = store.get('agents')
      exportData.apiKeys = store.get('apiKeys')
    }
    if (type === 'settings' || type === 'all') {
      exportData.mcpEndpoints = store.get('mcpEndpoints')
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
