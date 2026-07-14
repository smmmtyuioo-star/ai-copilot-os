import { NextRequest, NextResponse } from 'next/server'

const PROVIDERS: Record<string, { baseUrl: string; envKey: () => string; envVar: string }> = {
  openai: { baseUrl: 'https://api.openai.com/v1', envKey: () => process.env.OPENAI_API_KEY || '', envVar: 'OPENAI_API_KEY' },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', envKey: () => process.env.GROQ_API_KEY || '', envVar: 'GROQ_API_KEY' },
}

function getProvider(model: string) {
  if (model.startsWith('gpt-')) return PROVIDERS.openai
  if (['llama-', 'mixtral-', 'gemma-'].some(p => model.startsWith(p))) return PROVIDERS.groq
  return PROVIDERS.groq
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
          { role: 'system', content: agent.system_prompt },
          { role: 'user', content: userRequest },
        ],
        max_tokens: 4096,
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
