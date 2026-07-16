import { NextRequest, NextResponse } from 'next/server'
import { generateId } from '@/lib/utils'
import { localStore } from '@/lib/storage'
import { ok, fail, serverError } from '@/lib/api-utils'

function maskKey(key: string): string {
  if (key.length <= 8) return '****'
  return key.slice(0, 4) + '****' + key.slice(-4)
}

export async function GET() {
  try {
    if (typeof window === 'undefined') {
      return NextResponse.json({ error: 'This endpoint is client-side only', hint: 'Settings storage is client-side only. Use the browser interface.' }, { status: 501 })
    }
    const masked = localStore.apiKeys.items.map(k => ({ ...k, key: maskKey(k.key) }))
    return ok(masked)
  } catch (e) { return serverError(e) }
}

export async function POST(request: NextRequest) {
  try {
    if (typeof window === 'undefined') {
      return NextResponse.json({ error: 'This endpoint is client-side only', hint: 'Settings storage is client-side only. Use the browser interface.' }, { status: 501 })
    }
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
    if (typeof window === 'undefined') {
      return NextResponse.json({ error: 'This endpoint is client-side only', hint: 'Settings storage is client-side only. Use the browser interface.' }, { status: 501 })
    }
    const { id, name, key, provider } = await request.json()
    if (!id) return fail('ID is required')
    localStore.apiKeys.update(id, { name, key, provider })
    return ok(null, 'API key updated')
  } catch (e) { return serverError(e) }
}

export async function DELETE(request: NextRequest) {
  try {
    if (typeof window === 'undefined') {
      return NextResponse.json({ error: 'This endpoint is client-side only', hint: 'Settings storage is client-side only. Use the browser interface.' }, { status: 501 })
    }
    const { id } = await request.json()
    if (!id) return fail('ID is required')
    localStore.apiKeys.remove(id)
    return ok(null, 'API key deleted')
  } catch (e) { return serverError(e) }
}
