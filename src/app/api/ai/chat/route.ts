import { NextRequest, NextResponse } from 'next/server'

const PROVIDERS: Record<string, { baseUrl: string; envKey: () => string; envVar: string; models: string[] }> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    envKey: () => process.env.OPENAI_API_KEY || '',
    envVar: 'OPENAI_API_KEY',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4', 'gpt-3.5-turbo'],
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    envKey: () => process.env.GROQ_API_KEY || '',
    envVar: 'GROQ_API_KEY',
    models: [
      'llama-3.3-70b-versatile', 'llama-3.1-8b-instant',
      'mixtral-8x7b-32768', 'gemma2-9b-it',
    ],
  },
}

function detectProvider(model: string): string | null {
  if (model.startsWith('gpt-')) return 'openai'
  if (['llama-', 'mixtral-', 'gemma-'].some(p => model.startsWith(p))) return 'groq'
  return null
}

export async function POST(request: NextRequest) {
  try {
    const { messages, model, provider: explicitProvider } = await request.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 })
    }

    const modelToUse = model || process.env.NEXT_PUBLIC_DEFAULT_AI_MODEL || 'llama-3.3-70b-versatile'
    const providerName = explicitProvider || detectProvider(modelToUse) || process.env.NEXT_PUBLIC_DEFAULT_AI_PROVIDER || 'groq'
    const provider = PROVIDERS[providerName]

    if (!provider) {
      return NextResponse.json({
        error: `Unknown provider "${providerName}". Supported: ${Object.keys(PROVIDERS).join(', ')}`,
      }, { status: 400 })
    }

    const apiKey = provider.envKey()
    if (!apiKey) {
      return NextResponse.json({
        error: `${providerName} API key is not configured. Set ${provider.envVar} in your environment variables.`,
        config: {
          provider: providerName,
          key: `Set ${provider.envVar} in .env.local`,
          signup: providerName === 'groq' ? 'https://console.groq.com/keys' : 'https://platform.openai.com/api-keys',
        },
      }, { status: 503 })
    }

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          {
            role: 'system',
            content: 'You are AI Copilot OS, a helpful AI assistant. You help users build software, automate workflows, research topics, and manage their digital workspace. Be concise, accurate, and helpful. Never pretend to perform actions you cannot actually execute.',
          },
          ...messages,
        ],
        stream: true,
        max_tokens: parseInt(process.env.NEXT_PUBLIC_AI_MAX_TOKENS || '4096'),
        temperature: parseFloat(process.env.NEXT_PUBLIC_AI_TEMPERATURE || '0.7'),
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: `${providerName} API error: ${error.error?.message || response.statusText}` },
        { status: response.status },
      )
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        if (!reader) { controller.close(); return }

        while (true) {
          const { done, value } = await reader.read()
          if (done) {
            controller.close()
            break
          }
          controller.enqueue(value)
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
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
