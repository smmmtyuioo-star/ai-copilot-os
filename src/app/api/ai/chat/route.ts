import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/config/env'

const PROVIDERS: Record<string, { baseUrl: string; key: () => string; envVar: string; models: string[] }> = {
  omniroute: {
    baseUrl: 'https://api.omniroute.online/v1',
    key: () => env.ai.omnirouteKey,
    envVar: 'OMNIROUTE_API_KEY',
    models: [
      'gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini',
      'claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022', 'claude-3-opus-20240229',
      'llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it',
      'command-r-plus', 'command-r',
    ],
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    key: () => env.ai.groqKey,
    envVar: 'GROQ_API_KEY',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    key: () => env.ai.openaiKey,
    envVar: 'OPENAI_API_KEY',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo'],
  },
  anthropic: {
    baseUrl: 'https://api.anthropic.com/v1',
    key: () => env.ai.anthropicKey,
    envVar: 'ANTHROPIC_API_KEY',
    models: ['claude-3-5-sonnet-20241022', 'claude-3-5-haiku-20241022'],
  },
}

function detectProvider(model: string): string | null {
  // OmniRoute handles ALL models - it's the primary gateway
  if (env.ai.omnirouteKey) return 'omniroute'
  // Fallback detection for direct providers
  if (model.startsWith('gpt-')) return 'openai'
  if (model.startsWith('claude-')) return 'anthropic'
  if (['llama-', 'mixtral-', 'gemma-'].some(p => model.startsWith(p))) return 'groq'
  return null
}

const SYSTEM_PROMPT = `You are AI Copilot OS — a full-stack AI engineering assistant capable of any task. You have deep expertise across:

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

Whenever the user asks a question or requests a task, use ALL relevant capabilities to produce the best possible answer. Be concise, accurate, and thorough. If you need to search for current information, say so. Never refuse a technical challenge — figure it out step by step.`

export async function POST(request: NextRequest) {
  try {
    const { messages, model, provider: explicitProvider, stream: doStream = true, temperature, max_tokens } = await request.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 })
    }

    // Use OmniRoute as primary if available, otherwise auto-detect
    const modelToUse = model || env.ai.defaultModel
    let providerName = explicitProvider || detectProvider(modelToUse) || (env.ai.omnirouteKey ? 'omniroute' : env.ai.defaultProvider)
    
    // Fallback chain: omniroute -> groq -> openai -> anthropic
    const fallbackChain = ['omniroute', 'groq', 'openai', 'anthropic']
    const startIndex = fallbackChain.indexOf(providerName)
    const providersToTry = fallbackChain.slice(startIndex >= 0 ? startIndex : 0)

    let lastError = ''
    
    for (const providerName of providersToTry) {
      const provider = PROVIDERS[providerName]

      if (!provider) {
        lastError = `Unknown provider: ${providerName}`
        continue
      }

      const apiKey = provider.key()
      if (!apiKey) {
        lastError = `${providerName} API key not configured`
        continue
      }

      const response = await fetch(`${provider.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: modelToUse,
          messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
          stream: doStream,
          max_tokens: max_tokens ?? env.ai.maxTokens,
          temperature: temperature ?? env.ai.temperature,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        lastError = `${providerName}: ${error.error?.message || response.statusText}`
        // Continue to next fallback on rate limit or server error
        if (response.status === 429 || response.status >= 500) continue
        return NextResponse.json(
          { error: lastError },
          { status: response.status }
        )
      }

      if (!doStream) {
        const data = await response.json()
        return NextResponse.json(data)
      }

      // Success - stream the response
      const encoder = new TextEncoder()
      const responseStream = new ReadableStream({
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

      return new Response(responseStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      })
    }

    return NextResponse.json(
      { error: `All providers failed. Last error: ${lastError}` },
      { status: 503 }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    providers: Object.entries(PROVIDERS).map(([id, p]) => ({
      id,
      name: id.charAt(0).toUpperCase() + id.slice(1),
      models: p.models,
      available: !!p.key(),
    })),
  })
}