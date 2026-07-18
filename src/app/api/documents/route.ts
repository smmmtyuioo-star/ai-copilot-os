import { NextRequest, NextResponse } from 'next/server'
import { generateId } from '@/lib/utils'
import { ok, fail, serverError } from '@/lib/api-utils'
import { getServerStore } from '@/lib/server-store'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all'
    const store = getServerStore()
    let docs = store.get('documents')
    return ok(docs)
  } catch (e) { return serverError(e) }
}

export async function POST(request: NextRequest) {
  try {
    const { title, content, type } = await request.json()
    if (!title || !content) return fail('Title and content are required')
    const doc = {
      id: generateId(), title, content, type: type || 'text',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    const store = getServerStore()
    store.add('documents', doc)
    return ok(doc, 'Document saved')
  } catch (e) { return serverError(e) }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, title, content, type } = await request.json()
    if (!id) return fail('ID is required')
    const store = getServerStore()
    store.update('documents', id, { title, content, type, updatedAt: new Date().toISOString() })
    return ok(null, 'Document updated')
  } catch (e) { return serverError(e) }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (!id) return fail('ID is required')
    const store = getServerStore()
    store.remove('documents', id)
    return ok(null, 'Document deleted')
  } catch (e) { return serverError(e) }
}
