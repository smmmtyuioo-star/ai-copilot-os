import { NextRequest, NextResponse } from 'next/server'
import { ok, fail, serverError } from '@/lib/api-utils'
import { getServerStore } from '@/lib/server-store'

const MAX_RECORDS = 500

export async function GET() {
  try {
    const store = getServerStore()
    const records = store.list('promptRecords') as any[]
    const limited = records.slice(0, 100)
    return ok(limited)
  } catch (e) { return serverError(e) }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    if (!body.source || !body.model) return fail('source and model are required')

    const record = {
      id: `prompt_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      source: body.source || 'unknown',
      model: body.model,
      provider: body.provider || 'unknown',
      systemPrompt: body.systemPrompt || '',
      messages: body.messages || [],
      tools: body.tools || [],
      mcpEndpoints: body.mcpEndpoints || [],
      temperature: body.temperature,
      maxTokens: body.maxTokens,
      durationMs: body.durationMs || 0,
      success: body.success !== undefined ? body.success : true,
      error: body.error || '',
      responseContent: body.responseContent || '',
      tokenCount: body.tokenCount,
      fullPayload: body.fullPayload || null,
    }

    const store = getServerStore()
    store.add('promptRecords', record)

    const all = store.list('promptRecords')
    if (all.length > MAX_RECORDS) {
      const toKeep = all.slice(0, MAX_RECORDS)
      for (const old of all.slice(MAX_RECORDS)) {
        store.remove('promptRecords', old.id)
      }
    }

    return ok({ id: record.id }, 'Prompt recorded')
  } catch (e) { return serverError(e) }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (id === 'all') {
      const store = getServerStore()
      const all = store.list('promptRecords')
      for (const r of all) store.remove('promptRecords', r.id)
      return ok(null, 'All records cleared')
    }
    if (!id) return fail('id is required')
    const store = getServerStore()
    store.remove('promptRecords', id)
    return ok(null, 'Record deleted')
  } catch (e) { return serverError(e) }
}
