import { NextRequest } from 'next/server'
import { generateId } from '@/lib/utils'
import { localStore } from '@/lib/storage'
import { ok, fail, serverError } from '@/lib/api-utils'

export async function GET() {
  try {
    const items = localStore.memories.items
    return ok(items)
  } catch (e) { return serverError(e) }
}

export async function POST(request: NextRequest) {
  try {
    const { content, type } = await request.json()
    if (!content) return fail('Content is required')
    const entry = { id: generateId(), content, type: type || 'short-term', createdAt: new Date().toISOString() }
    localStore.memories.add(entry)
    return ok(entry, 'Memory saved')
  } catch (e) { return serverError(e) }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (!id) return fail('ID is required')
    localStore.memories.remove(id)
    return ok(null, 'Memory deleted')
  } catch (e) { return serverError(e) }
}
