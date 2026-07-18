import { NextRequest, NextResponse } from 'next/server'
import { generateId } from '@/lib/utils'
import { ok, fail, serverError } from '@/lib/api-utils'
import { getServerStore } from '@/lib/server-store'

interface MCPEndpoint {
  id: string
  name: string
  url: string
  protocol: string
  status: 'active' | 'inactive' | 'error'
  createdAt: string
  lastCheckedAt?: string
  lastError?: string
  toolCount?: number
}

const BLOCKED_HOSTS = ['localhost', '127.0.0.1', '0.0.0.0', '[::1]', '[::]']
const PRIVATE_IPS = ['10.', '192.168.', '172.16.', '172.17.', '172.18.', '172.19.',
  '172.20.', '172.21.', '172.22.', '172.23.', '172.24.', '172.25.', '172.26.',
  '172.27.', '172.28.', '172.29.', '172.30.', '172.31.', '169.254.']

async function healthCheck(endpoint: MCPEndpoint): Promise<{ ok: boolean; toolCount?: number; error?: string }> {
  try {
    const parsed = new URL(endpoint.url)
    const hostname = parsed.hostname.toLowerCase()
    if (BLOCKED_HOSTS.includes(hostname) || PRIVATE_IPS.some(p => hostname.startsWith(p))) {
      return { ok: false, error: 'Private/internal addresses not allowed' }
    }

    const sseUrl = parsed.pathname.endsWith('/sse') ? endpoint.url : `${endpoint.url.replace(/\/$/, '')}/sse`
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(sseUrl, {
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok && res.status !== 405) {
      return { ok: false, error: `HTTP ${res.status}` }
    }
    return { ok: true, toolCount: 0 }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Connection failed' }
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const checkHealth = searchParams.get('checkHealth') === 'true'
    const store = getServerStore()
    const endpoints = store.list('mcpEndpoints') as MCPEndpoint[]

    if (checkHealth && endpoints.length > 0) {
      const results = await Promise.all(
        endpoints.map(async (ep) => {
          const result = await healthCheck(ep)
          const updates: Partial<MCPEndpoint> = {
            lastCheckedAt: new Date().toISOString(),
            status: result.ok ? 'active' : 'error',
            lastError: result.error,
            toolCount: result.toolCount ?? ep.toolCount ?? 0,
          }
          store.update('mcpEndpoints', ep.id, updates)
          return { ...ep, ...updates }
        }),
      )
      return ok(results)
    }
    return ok(endpoints)
  } catch (e) { return serverError(e) }
}

export async function POST(request: NextRequest) {
  try {
    const { name, url, protocol } = await request.json()
    if (!name || !url) return fail('Name and URL are required')
    try { new URL(url) } catch { return fail('Invalid URL') }

    const store = getServerStore()
    const endpoint: MCPEndpoint = {
      id: generateId(),
      name: name.trim(),
      url: url.trim(),
      protocol: protocol || 'mcp',
      status: 'active',
      createdAt: new Date().toISOString(),
    }
    const health = await healthCheck(endpoint)
    endpoint.status = health.ok ? 'active' : 'error'
    endpoint.lastError = health.error
    endpoint.lastCheckedAt = new Date().toISOString()
    endpoint.toolCount = health.toolCount ?? 0
    store.add('mcpEndpoints', endpoint)
    return ok(endpoint, 'MCP endpoint added')
  } catch (e) { return serverError(e) }
}

export async function PUT(request: NextRequest) {
  try {
    const { id, name, url, protocol, status } = await request.json()
    if (!id) return fail('ID is required')
    const store = getServerStore()
    const updates: Partial<MCPEndpoint> = {}
    if (name !== undefined) updates.name = name
    if (url !== undefined) updates.url = url
    if (protocol !== undefined) updates.protocol = protocol
    if (status !== undefined) updates.status = status
    if (url) {
      try { new URL(url) } catch { return fail('Invalid URL') }
    }
    store.update('mcpEndpoints', id, updates)
    return ok(null, 'MCP endpoint updated')
  } catch (e) { return serverError(e) }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id } = await request.json()
    if (!id) return fail('ID is required')
    const store = getServerStore()
    store.remove('mcpEndpoints', id)
    return ok(null, 'MCP endpoint deleted')
  } catch (e) { return serverError(e) }
}
