import { NextRequest, NextResponse } from 'next/server'
import { generateId } from '@/lib/utils'
import { ok, fail, serverError } from '@/lib/api-utils'
import { getServerStore } from '@/lib/server-store'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const q = searchParams.get('q')?.toLowerCase()
    const store = getServerStore()
    let items = store.get('memories')
    if (q) items = items.filter((m: any) => m.content.toLowerCase().includes(q))
    return ok(items)
  } catch (e) { return serverError(e) }
}

export async function POST(request: NextRequest) {
  try {
    const { content, type } = await request.json()
    if (!content) return fail('Content is required')
    const entry = { id: generateId(), content, type: type || 'knowledge', createdAt: new Date().toISOString() }
    const store = getServerStore()
    store.add('memories', entry)
    return ok(entry, 'Knowledge saved')
  } catch (e) { return serverError(e) }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (!id) return fail('ID is required')
    const store = getServerStore()
    store.remove('memories', id)
    return ok(null, 'Knowledge deleted')
  } catch (e) { return serverError(e) }
}
