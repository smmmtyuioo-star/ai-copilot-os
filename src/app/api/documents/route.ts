import { NextRequest, NextResponse } from 'next/server'
import { generateId } from '@/lib/utils'
import { ok, fail, serverError } from '@/lib/api-utils'
import { runAgentLoop } from '@/services/agent-loop'

export async function GET(request: NextRequest) {
  try {
    if (typeof window === 'undefined') {
      return NextResponse.json({ error: 'This endpoint is client-side only', hint: 'Document storage is client-side only. Use the browser interface.' }, { status: 501 })
    }
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'all'
    const localDocs = typeof window !== 'undefined'
      ? JSON.parse(localStorage.getItem('ac_documents') || '[]')
      : []
    return ok(localDocs)
  } catch (e) { return serverError(e) }
}

export async function POST(request: NextRequest) {
  try {
    if (typeof window === 'undefined') {
      return NextResponse.json({ error: 'This endpoint is client-side only', hint: 'Document storage is client-side only. Use the browser interface.' }, { status: 501 })
    }
    const { title, content, type } = await request.json()
    if (!title || !content) return fail('Title and content are required')
    const doc = {
      id: generateId(), title, content, type: type || 'text',
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    const existing = JSON.parse(
      typeof window !== 'undefined' ? localStorage.getItem('ac_documents') || '[]' : '[]'
    )
    existing.push(doc)
    if (typeof window !== 'undefined') localStorage.setItem('ac_documents', JSON.stringify(existing))
    return ok(doc, 'Document saved')
  } catch (e) { return serverError(e) }
}

export async function PUT(request: NextRequest) {
  try {
    if (typeof window === 'undefined') {
      return NextResponse.json({ error: 'This endpoint is client-side only', hint: 'Document storage is client-side only. Use the browser interface.' }, { status: 501 })
    }
    const { id, title, content, type } = await request.json()
    if (!id) return fail('ID is required')
    const docs = JSON.parse(
      typeof window !== 'undefined' ? localStorage.getItem('ac_documents') || '[]' : '[]'
    )
    const idx = docs.findIndex((d: any) => d.id === id)
    if (idx < 0) return fail('Document not found', 404)
    docs[idx] = { ...docs[idx], title, content, type, updatedAt: new Date().toISOString() }
    if (typeof window !== 'undefined') localStorage.setItem('ac_documents', JSON.stringify(docs))
    return ok(null, 'Document updated')
  } catch (e) { return serverError(e) }
}

export async function DELETE(request: NextRequest) {
  try {
    if (typeof window === 'undefined') {
      return NextResponse.json({ error: 'This endpoint is client-side only', hint: 'Document storage is client-side only. Use the browser interface.' }, { status: 501 })
    }
    const { id } = await request.json()
    if (!id) return fail('ID is required')
    const docs = JSON.parse(
      typeof window !== 'undefined' ? localStorage.getItem('ac_documents') || '[]' : '[]'
    )
    const filtered = docs.filter((d: any) => d.id !== id)
    if (typeof window !== 'undefined') localStorage.setItem('ac_documents', JSON.stringify(filtered))
    return ok(null, 'Document deleted')
  } catch (e) { return serverError(e) }
}
