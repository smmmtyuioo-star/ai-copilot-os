import { NextRequest } from 'next/server'
import { generateId } from '@/lib/utils'
import { localStore } from '@/lib/storage'
import { ok, fail, serverError } from '@/lib/api-utils'

export async function GET() {
  try {
    return ok(localStore.apiKeys.items)
  } catch (e) { return serverError(e) }
}

export async function POST(request: NextRequest) {
  try {
    const { name, key, provider } = await request.json()
    if (!name || !key) return fail('Name and key are required')
    const entry = {
      id: generateId(), name, key, provider: provider || 'custom',
      createdAt: new Date().toISOString(),
    }
    localStore.apiKeys.add(entry)
    return ok(entry, 'API key saved')
  } catch (e) { return serverError(e) }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, name, key, provider } = await request.json()
    if (!id) return fail('ID is required')
    localStore.apiKeys.update(id, { name, key, provider })
    return ok(null, 'API key updated')
  } catch (e) { return serverError(e) }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (!id) return fail('ID is required')
    localStore.apiKeys.remove(id)
    return ok(null, 'API key deleted')
  } catch (e) { return serverError(e) }
}
