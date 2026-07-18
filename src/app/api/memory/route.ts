import { NextRequest, NextResponse } from 'next/server'
import { generateId } from '@/lib/utils'
import { ok, fail, serverError } from '@/lib/api-utils'
import { getServerStore } from '@/lib/server-store'

export async function GET() {
  try {
    const store = getServerStore()
    return ok(store.get('memories'))
  } catch (e) { return serverError(e) }
}

export async function POST(request: NextRequest) {
  try {
    const { content, type } = await request.json()
    if (!content) return fail('Content is required')
    const entry = { id: generateId(), content, type: type || 'short-term', createdAt: new Date().toISOString() }
    const store = getServerStore()
    store.add('memories', entry)
    return ok(entry, 'Memory saved')
  } catch (e) { return serverError(e) }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (!id) return fail('ID is required')
    const store = getServerStore()
    store.remove('memories', id)
    return ok(null, 'Memory deleted')
  } catch (e) { return serverError(e) }
}
