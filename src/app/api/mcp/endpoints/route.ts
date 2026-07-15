import { NextRequest } from 'next/server'
import { generateId } from '@/lib/utils'
import { localStore } from '@/lib/storage'
import { ok, fail, serverError } from '@/lib/api-utils'

export async function GET() {
  try {
    return ok(localStore.mcpEndpoints.items)
  } catch (e) { return serverError(e) }
}

export async function POST(request: NextRequest) {
  try {
    const { name, url, protocol } = await request.json()
    if (!name || !url) return fail('Name and URL are required')
    const endpoint = {
      id: generateId(), name, url, protocol: protocol || 'mcp',
      status: 'active' as const, createdAt: new Date().toISOString(),
    }
    localStore.mcpEndpoints.add(endpoint)
    return ok(endpoint, 'MCP endpoint added')
  } catch (e) { return serverError(e) }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, name, url, protocol, status } = await request.json()
    if (!id) return fail('ID is required')
    localStore.mcpEndpoints.update(id, { name, url, protocol, status })
    return ok(null, 'MCP endpoint updated')
  } catch (e) { return serverError(e) }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (!id) return fail('ID is required')
    localStore.mcpEndpoints.remove(id)
    return ok(null, 'MCP endpoint deleted')
  } catch (e) { return serverError(e) }
}
