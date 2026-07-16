import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/config/env'
import { runAgentLoop } from '@/services/agent-loop'
import { verify } from '@/services/verification'
import { classifyIntent } from '@/services/intent-classifier'
import { selectTier } from '@/services/tier-router'

const PROVIDERS: Record<string, { baseUrl: string; key: () => string; envVar: string; models: string[] }> = {
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    key: () => env.ai.groqKey,
    envVar: 'GROQ_API_KEY',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768', 'gemma2-9b-it'],
  },
  cerebras: {
    baseUrl: 'https://api.cerebras.ai/v1',
    key: () => env.ai.cerebrasKey,
    envVar: 'CEREBRAS_API_KEY',
    models: ['llama-3.3-70b', 'llama-3.1-70b'],
  },
  fireworks: {
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    key: () => env.ai.fireworksKey,
    envVar: 'FIREWORKS_API_KEY',
    models: ['accounts/fireworks/models/llama-v3p3-70b-instruct', 'accounts/fireworks/models/llama-v3p1-70b-instruct'],
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    key: () => env.ai.deepseekKey,
    envVar: 'DEEPSEEK_API_KEY',
    models: ['deepseek-chat', 'deepseek-coder'],
  },
  mistral: {
    baseUrl: 'https://api.mistral.ai/v1',
    key: () => env.ai.mistralKey,
    envVar: 'MISTRAL_API_KEY',
    models: ['mistral-large', 'mistral-medium', 'mistral-small'],
  },
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    key: () => env.ai.openrouterKey,
    envVar: 'OPENROUTER_API_KEY',
    models: ['openai/gpt-4o', 'anthropic/claude-3.5-sonnet', 'meta-llama/llama-3.3-70b-instruct', 'google/gemini-pro'],
  },
  cloudflare: {
    baseUrl: `https://api.cloudflare.com/client/v4/accounts/${env.ai.cloudflareAccountId}/ai/run`,
    key: () => env.ai.cloudflareApiToken,
    envVar: 'CLOUDFLARE_API_TOKEN',
    models: ['@cf/meta/llama-3.3-70b-instruct', '@cf/meta/llama-3.1-8b-instruct', '@cf/mistral/mistral-7b-instruct-v0.1', '@cf/deepseek/deepseek-r1-distill-qwen-32b'],
  },
  nvidia: {
    baseUrl: 'https://integrate.api.nvidia.com/v1',
    key: () => env.ai.nvidiaKey,
    envVar: 'NVIDIA_API_KEY',
    models: ['nvidia/llama-3.3-nvcf', 'mistralai/mistral-7b-instruct-v0.3', 'google/gemma-2-27b-it'],
  },
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    key: () => env.ai.googleGeminiKey,
    envVar: 'GOOGLE_GEMINI_KEY',
    models: ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-flash', 'gemini-1.5-pro'],
  },
}

function detectProvider(model: string): string | null {
  if (env.ai.groqKey) return 'groq'
  if (model.startsWith('gpt-')) return 'openrouter'
  if (model.startsWith('claude-')) return 'openrouter'
  if (['llama-', 'mixtral-', 'gemma-'].some(p => model.startsWith(p))) return 'groq'
  if (model.startsWith('deepseek-')) return 'deepseek'
  if (model.startsWith('mistral-')) return 'mistral'
  if (model.startsWith('accounts/')) return 'fireworks'
  if (model.startsWith('@cf/')) return 'cloudflare'
  if (model.startsWith('nvidia/') || model.startsWith('mistralai/')) return 'nvidia'
  if (model.startsWith('gemini-')) return 'gemini'
  return null
}

function getModelMaxTokens(model: string): number {
  const modelLower = model.toLowerCase();
  if (modelLower.includes('claude-3.5') || modelLower.includes('claude-3-5')) return 8192;
  if (modelLower.includes('gpt-4o')) return 16384;
  if (modelLower.includes('gemini-1.5') || modelLower.includes('gemini-2.0')) return 8192;
  if (modelLower.includes('llama-3.3')) return 8192; // Many providers support 8k+ for 3.3
  if (modelLower.includes('mixtral')) return 32768;
  return env.ai.maxTokens;
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

THINKING PATTERN: Use "constraints first, prototype risk" thinking. Before proposing a solution: (1) identify all constraints — technical, business, time, skill, environment, (2) identify the riskiest assumption in any approach, (3) prototype to validate that risk first. Give concrete, actionable plans starting from constraints. Prioritize simplicity and iteration over perfect upfront design.

FREE LLM PROVIDERS: The system supports multiple free or low-cost providers. Available: Groq (free tier — llama-3.3-70b, mixtral, gemma), Cerebras (fast inference), Fireworks AI, DeepSeek, Mistral, OpenRouter (gateway to GPT-4o, Claude), Cloudflare Workers AI, NVIDIA (free tier — llama, mistral, gemma), Google Gemini (free tier — gemini-2.0-flash, gemini-1.5-flash/pro via GOOGLE_GEMINI_KEY). Users can bring their own keys via the connectors page. When recommending an approach, suggest the most cost-effective model that fits the task complexity — Gemini 2.0 Flash and Groq's Llama are excellent free options.

AI CODING RULES: Users interact through a chat interface. To get the best results: be specific about goals and constraints, define the tech stack upfront, ask for exactly one task per message, share error messages verbatim, provide exact file paths when discussing code, use /build command for project scaffolding. When the user says "build a game" or "build a website", the system auto-triggers the dedicated game builder or website builder to generate a complete, playable HTML file.

Whenever the user asks a question or requests a task, use ALL relevant capabilities to produce the best possible answer. Be concise, accurate, and thorough. If you need to search for current information, say so. Never refuse a technical challenge — figure it out step by step.`

export async function POST(request: NextRequest) {
  try {
    const { messages, model, provider: explicitProvider, stream: doStream = true, temperature, max_tokens, tools, mcpEndpoints, user_id } = await request.json()

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 })
    }

    const modelToUse = model || env.ai.defaultModel

    if (tools && Array.isArray(tools) && tools.length > 0) {
      const lastUserMsg = messages.filter(m => m.role === 'user').pop()?.content || ''
      const classification = await classifyIntent(lastUserMsg)
      const tierConfig = selectTier({
        intent: classification.intent,
        messageLength: lastUserMsg.length,
        explicitModel: model,
      })

      const modelForLoop = tierConfig.model;
      const result = await runAgentLoop({
        messages, tools, mcpEndpoints, model: modelForLoop,
        temperature: temperature ?? tierConfig.temperature,
        maxTokens: max_tokens ?? getModelMaxTokens(modelForLoop),
        maxTurns: tierConfig.maxTurns,
        userId: user_id,
      })

      if (!result.success) {
        return NextResponse.json({ error: result.error || 'Agent loop failed' }, { status: 500 })
      }

      if (result.needsConfirmation) {
        return NextResponse.json({
          needsConfirmation: {
            sessionId: result.needsConfirmation.sessionId,
            tool: result.needsConfirmation.tool,
            summary: result.needsConfirmation.summary,
            args: result.needsConfirmation.args,
          },
        })
      }

      let content = result.content

      if (tierConfig.useVerification && lastUserMsg && content) {
        const verification = await verify({
          response: content,
          originalRequest: lastUserMsg,
          intent: classification.intent,
          expectedLength: undefined,
        })
        if (!verification.passed) {
          content += '\n\n' + verification.issues.map(i => `[Note: ${i.detail}]`).join('\n')
        }
      }

      if (!doStream) {
        return NextResponse.json({
          choices: [{ message: { role: 'assistant', content } }],
        })
      }

      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        start(controller) {
          const lines = content.match(/.{1,100}/g) || [content]
          for (const line of lines) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: line } }] })}\n\n`))
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        },
      })

      return new Response(stream, {
        headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
      })
    }

    let providerName = explicitProvider || detectProvider(modelToUse) || 'groq'

    const fallbackChain = ['groq', 'cerebras', 'fireworks', 'deepseek', 'mistral', 'openrouter', 'cloudflare', 'nvidia', 'gemini']
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
          max_tokens: max_tokens ?? getModelMaxTokens(modelToUse),
          temperature: temperature ?? env.ai.temperature,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        lastError = `${providerName}: ${error.error?.message || response.statusText}`
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