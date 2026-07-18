import { NextRequest, NextResponse } from 'next/server'
import { apiBridge } from '@/services/api-bridge'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { surface, action, payload, auth } = body

    if (!surface || !action) {
      return NextResponse.json({ error: 'surface and action are required' }, { status: 400 })
    }

    const validSurfaces = ['cli', 'ide', 'desktop', 'chat', 'web']
    if (!validSurfaces.includes(surface)) {
      return NextResponse.json({ error: `Invalid surface: ${surface}. Must be one of: ${validSurfaces.join(', ')}` }, { status: 400 })
    }

    const response = await apiBridge.sendRequest({
      surface,
      action,
      payload: payload || {},
      auth,
    })

    return NextResponse.json(response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Bridge request failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'operational',
    version: '1.0.0',
    surfaces: apiBridge.getSurfaceStatus(),
    cli: apiBridge.generateCliSnippet(),
    ide: apiBridge.generateVsCodeExtensionSnippet(),
  })
}
