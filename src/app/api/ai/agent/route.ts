import { NextRequest, NextResponse } from 'next/server'

const PROVIDERS: Record<string, { baseUrl: string; envKey: () => string; envVar: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', envKey: () => process.env.OPENAI_API_KEY || '', envVar: 'OPENAI_API_KEY' },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', envKey: () => process.env.GROQ_API_KEY || '', envVar: 'GROQ_API_KEY' },
  nvidia: { baseUrl: 'https://integrate.api.nvidia.com/v1', envKey: () => process.env.NVIDIA_API_KEY || '', envVar: 'NVIDIA_API_KEY' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', envKey: () => process.env.GOOGLE_GEMINI_KEY || '', envVar: 'GOOGLE_GEMINI_KEY' },
}

function getProvider(model: string) {
  if (model.startsWith('gpt-')) return PROVIDERS.openai
  if (['llama-', 'mixtral-', 'gemma-'].some(p => model.startsWith(p))) return PROVIDERS.groq
  if (model.startsWith('nvidia/') || model.startsWith('mistralai/')) return PROVIDERS.nvidia
  if (model.startsWith('gemini-')) return PROVIDERS.gemini
  return PROVIDERS.groq
}

function getModelMaxTokens(model: string): number {
  const modelLower = model.toLowerCase();
  if (modelLower.includes('claude-3.5') || modelLower.includes('claude-3-5')) return 8192;
  if (modelLower.includes('gpt-4o')) return 16384;
  if (modelLower.includes('gemini-1.5') || modelLower.includes('gemini-2.0')) return 8192;
  if (modelLower.includes('llama-3.3')) return 8192;
  if (modelLower.includes('mixtral')) return 32768;
  return 4096;
}

export async function POST(request: NextRequest) {
  try {
    const { agent, request: userRequest } = await request.json()

    if (!agent || !userRequest) {
      return NextResponse.json({ error: 'Agent and request are required' }, { status: 400 })
    }

    const provider = getProvider(agent.model || 'llama-3.3-70b-versatile')
    const apiKey = provider.envKey()

    if (!apiKey) {
      return NextResponse.json(
        { error: `API key not configured. Set ${provider.envVar} in your environment variables.`, config: { key: provider.envVar } },
        { status: 503 },
      )
    }

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: agent.model || 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: agent.system_prompt + '\n\nYou are part of AI Copilot OS — a full-stack engineering system. You can handle any task: frontend, backend, database, architecture, design, data analysis, trading systems, documentation, and more. Be thorough and precise.\n\nTHINKING PATTERN: Use "constraints first, prototype risk" — identify constraints, find the riskiest assumption, prototype to validate it first.\n\nFREE PROVIDERS: Groq, Cerebras, Fireworks, DeepSeek, Mistral, OpenRouter, Cloudflare, NVIDIA, Gemini are available via proxy route with BYOK.\n\nAI CODING RULES: Be specific, one task per message, share error messages, provide file paths. When user says "build a game" or "build a website", the system auto-triggers dedicated builders.' },
          { role: 'user', content: userRequest },
        ],
        max_tokens: getModelMaxTokens(agent.model || 'llama-3.3-70b-versatile'),
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: `Agent API error: ${error.error?.message || response.statusText}` },
        { status: response.status },
      )
    }

    const data = await response.json()
    return NextResponse.json({
      output: data.choices[0]?.message?.content || '',
      model: data.model,
      usage: data.usage,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
