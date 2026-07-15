import { NextRequest, NextResponse } from 'next/server'

const PROVIDER_BASE_URLS: Record<string, string> = {
  groq: 'https://api.groq.com/openai/v1',
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com/v1',
  deepseek: 'https://api.deepseek.com/v1',
  mistral: 'https://api.mistral.ai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
  cerebras: 'https://api.cerebras.ai/v1',
  fireworks: 'https://api.fireworks.ai/inference/v1',
  nvidia: 'https://integrate.api.nvidia.com/v1',
  gemini: 'https://generativelanguage.googleapis.com/v1beta/openai',
}

export async function POST(request: NextRequest) {
  try {
    const { provider, endpoint, body, apiKey } = await request.json()

    if (!provider || !endpoint) {
      return NextResponse.json({ error: 'provider and endpoint are required' }, { status: 400 })
    }

    const baseUrl = PROVIDER_BASE_URLS[provider]
    if (!baseUrl) {
      return NextResponse.json({ error: `Unknown provider: ${provider}` }, { status: 400 })
    }

    if (!apiKey) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }

    const url = `${baseUrl}${endpoint}`
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    }

    const doStream = body?.stream === true
    const fetchOptions: RequestInit = {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
    }

    const response = await fetch(url, fetchOptions)

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: error.error?.message || `Provider returned ${response.status}` },
        { status: response.status }
      )
    }

    if (doStream && response.body) {
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          const reader = response.body!.getReader()
          const decoder = new TextDecoder()
          while (true) {
            const { done, value } = await reader.read()
            if (done) { controller.close(); break }
            controller.enqueue(encoder.encode(decoder.decode(value, { stream: !done })))
          }
        },
      })
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    const data = await response.json()
    return NextResponse.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Proxy request failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
