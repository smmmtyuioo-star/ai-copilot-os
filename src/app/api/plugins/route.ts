import { NextRequest, NextResponse } from 'next/server'
import { generateId } from '@/lib/utils'
import { localStore } from '@/lib/storage'
import { ok, fail, serverError } from '@/lib/api-utils'

export async function GET() {
  try {
    if (typeof window === 'undefined') {
      return NextResponse.json({ error: 'This endpoint is client-side only', hint: 'Plugin management is client-side only.' }, { status: 501 })
    }
    return ok(localStore.agents.items)
  } catch (e) { return serverError(e) }
}

export async function POST(request: NextRequest) {
  try {
    if (typeof window === 'undefined') {
      return NextResponse.json({ error: 'This endpoint is client-side only', hint: 'Plugin management is client-side only.' }, { status: 501 })
    }
    const { name, role, model, systemPrompt, tools } = await request.json()
    if (!name) return fail('Name is required')
    const agent = {
      id: generateId(), name, role: role || 'research', model: model || 'llama-3.3-70b-versatile',
      systemPrompt: systemPrompt || '', tools: tools || [],
    }
    localStore.agents.add(agent)
    return ok(agent, 'Agent created')
  } catch (e) { return serverError(e) }
}

export async function PUT(request: NextRequest) {
  try {
    if (typeof window === 'undefined') {
      return NextResponse.json({ error: 'This endpoint is client-side only', hint: 'Plugin management is client-side only.' }, { status: 501 })
    }
    const { id, name, role, model, systemPrompt, tools } = await request.json()
    if (!id) return fail('ID is required')
    localStore.agents.update(id, { name, role, model, systemPrompt, tools })
    return ok(null, 'Agent updated')
  } catch (e) { return serverError(e) }
}

export async function DELETE(request: NextRequest) {
  try {
    if (typeof window === 'undefined') {
      return NextResponse.json({ error: 'This endpoint is client-side only', hint: 'Plugin management is client-side only.' }, { status: 501 })
    }
    const { id } = await request.json()
    if (!id) return fail('ID is required')
    localStore.agents.remove(id)
    return ok(null, 'Agent deleted')
  } catch (e) { return serverError(e) }
}
