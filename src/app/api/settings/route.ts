import { NextRequest, NextResponse } from 'next/server'
import { generateId } from '@/lib/utils'
import { ok, fail, serverError } from '@/lib/api-utils'
import { getServerStore } from '@/lib/server-store'

interface APIKey {
  id: string
  name: string
  key: string
  provider?: string
  createdAt: string
  updatedAt?: string
}

function maskKey(key: string): string {
  if (!key) return ''
  if (key.length <= 8) return '****'
  return key.slice(0, 4) + '****' + key.slice(-4)
}

function detectProvider(key: string): string {
  if (!key) return 'custom'
  if (key.startsWith('sk-ant-')) return 'anthropic'
  if (key.startsWith('sk-') && key.length > 40) return 'openai'
  if (key.startsWith('gsk_')) return 'groq'
  if (key.startsWith('csk-')) return 'cerebras'
  if (key.startsWith('sk-or-')) return 'openrouter'
  if (key.startsWith('nvapi-')) return 'nvidia'
  if (key.startsWith('cfut_')) return 'cloudflare'
  if (key.startsWith('tvly-')) return 'tavily'
  if (key.startsWith('github_') || key.startsWith('ghp_')) return 'github'
  if (key.startsWith('AIza')) return 'google'
  if (key.startsWith('sb_')) return 'supabase'
  return 'custom'
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeKeys = searchParams.get('includeKeys') === 'true'
    const store = getServerStore()
    const items = store.list('apiKeys') as APIKey[]
    const result = includeKeys ? items : items.map(k => ({ ...k, key: maskKey(k.key) }))
    return ok(result)
  } catch (e) { return serverError(e) }
}

export async function POST(request: NextRequest) {
  try {
    const { name, key, provider } = await request.json()
    if (!name || !key) return fail('Name and key are required')
    const store = getServerStore()
    const entry: APIKey = {
      id: generateId(),
      name: name.trim(),
      key: key.trim(),
      provider: (provider || detectProvider(key)).toLowerCase(),
      createdAt: new Date().toISOString(),
    }
    store.add('apiKeys', entry)
    return ok({ ...entry, key: maskKey(entry.key) }, 'API key saved')
  } catch (e) { return serverError(e) }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, name, key, provider } = await request.json()
    if (!id) return fail('ID is required')
    const store = getServerStore()
    const updates: Partial<APIKey> = {}
    if (name !== undefined) updates.name = name
    if (key !== undefined) {
      updates.key = key
      updates.provider = provider || detectProvider(key)
    }
    if (provider !== undefined) updates.provider = provider
    updates.updatedAt = new Date().toISOString()
    store.update('apiKeys', id, updates)
    return ok(null, 'API key updated')
  } catch (e) { return serverError(e) }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (!id) return fail('ID is required')
    const store = getServerStore()
    store.remove('apiKeys', id)
    return ok(null, 'API key deleted')
  } catch (e) { return serverError(e) }
}
