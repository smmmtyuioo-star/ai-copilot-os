import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    const parsed = new URL(url)
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return NextResponse.json({ error: 'Invalid protocol. Use http or https.' }, { status: 400 })
    }

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'AI-Copilot-OS/1.0 (Research Tool)',
        Accept: 'text/html,text/plain,application/json',
      },
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch: ${response.status} ${response.statusText}` },
        { status: response.status },
      )
    }

    const contentType = response.headers.get('content-type') || ''
    let content: string

    if (contentType.includes('text/html')) {
      const html = await response.text()
      content = html
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 10000)
    } else {
      content = (await response.text()).slice(0, 10000)
    }

    return NextResponse.json({
      content,
      url: url,
      contentType,
      size: content.length,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch URL'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
