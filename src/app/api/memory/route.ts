import { NextRequest, NextResponse } from 'next/server'
import { generateId } from '@/lib/utils'
import { localStore } from '@/lib/storage'
import { ok, fail, serverError } from '@/lib/api-utils'

export async function GET() {
  try {
    if (typeof window === 'undefined') {
      return NextResponse.json({ error: 'This endpoint is client-side only', hint: 'Memory storage is client-side only. Use the browser interface.' }, { status: 501 })
    }
    const items = localStore.memories.items
    return ok(items)
  } catch (e) { return serverError(e) }
}

export async function POST(request: NextRequest) {
  try {
    if (typeof window === 'undefined') {
      return NextResponse.json({ error: 'This endpoint is client-side only', hint: 'Memory storage is client-side only. Use the browser interface.' }, { status: 501 })
    }
    const { content, type } = await request.json()
    if (!content) return fail('Content is required')
    const entry = { id: generateId(), content, type: type || 'short-term', createdAt: new Date().toISOString() }
    localStore.memories.add(entry)
    return ok(entry, 'Memory saved')
  } catch (e) { return serverError(e) }
}

export async function DELETE(request: NextRequest) {
  try {
    if (typeof window === 'undefined') {
      return NextResponse.json({ error: 'This endpoint is client-side only', hint: 'Memory storage is client-side only. Use the browser interface.' }, { status: 501 })
    }
    const { id } = await request.json()
    if (!id) return fail('ID is required')
    localStore.memories.remove(id)
    return ok(null, 'Memory deleted')
  } catch (e) { return serverError(e) }
}
