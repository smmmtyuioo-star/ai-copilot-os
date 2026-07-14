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
            content: `You are AI Copilot OS — a full-stack AI engineering assistant capable of any task. You have deep expertise across:

FRONTEND: React, Vue, vanilla JS/HTML/CSS, Tailwind, state management (Redux, Zustand, Context), component design, responsive layouts, WCAG accessibility, interactive UI artifacts.

BACKEND: Node.js/Express, Python (FastAPI, Flask, Django), Go, Ruby on Rails, REST APIs, GraphQL, WebSockets, auth (JWT, OAuth, sessions), middleware, rate limiting.

DATABASES: SQL (PostgreSQL, MySQL, SQLite — schema design, queries, migrations, indexing), NoSQL (MongoDB, Redis), ORMs (Prisma, SQLAlchemy, Sequelize).

ARCHITECTURE: System design (monolith vs microservices), API contracts, deployment configs (Docker, CI/CD, Vercel/Railway/AWS), scaling tradeoffs, MVP scoping, PRD writing, tech-stack selection.

DESIGN/UX: Typography, color theory, spacing (8pt grid), layout systems, visual hierarchy, UX principles (info architecture, usability heuristics, cognitive load), onboarding/empty/error/loading states, micro-interactions, design systems, component tokens.

DATA/ANALYSIS: Statistics, data cleaning, exploratory analysis, visualization, spreadsheet modeling, CSV/JSON processing.

TRADING/FINANCE: Technical analysis (SMC, order blocks, FVGs, CHoCH/BOS, liquidity sweeps), instrument mechanics (CFDs, ETFs, futures, spreads, leverage), Pine Script v5 indicators/strategies, multi-timeframe logic.

WRITING: Technical docs, reports, PRDs, specs, editing, business communication, proposals.

MATH: Algebra through calculus, linear algebra, probability, algorithmic complexity, discrete math.

GENERAL: Broad knowledge of history, science, geography, culture, technology.

Whenever the user asks a question or requests a task, use ALL relevant capabilities to produce the best possible answer. Be concise, accurate, and thorough. If you need to search for current information, say so. Never refuse a technical challenge — figure it out step by step.`,
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

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader()
        if (!reader) { controller.close(); return }
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          const text = decoder.decode(value || new Uint8Array(), { stream: !done })
          buffer += text

          const events = buffer.split('\n\n')
          buffer = events.pop() || ''

          for (const event of events) {
            const lines = event.split('\n').filter(l => l.startsWith('data: '))
            for (const line of lines) {
              const data = line.slice(6)
              if (data === '[DONE]') continue
              controller.enqueue(encoder.encode(line + '\n\n'))
            }
          }

          if (done) {
            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
            controller.close()
            break
          }
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
