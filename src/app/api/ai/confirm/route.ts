import { NextRequest, NextResponse } from 'next/server'
import { resumeAgentLoop } from '@/services/agent-loop'

export async function POST(request: NextRequest) {
  try {
    const { sessionId, approved, tools, mcpEndpoints, userId } = await request.json()
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })
    }

    const result = await resumeAgentLoop(sessionId, approved === true, {
      messages: [],
      tools: tools || [],
      mcpEndpoints,
      userId: userId || 'anonymous',
    })

    if (!result.success) {
      const isClientError = result.error?.toLowerCase().includes('pending') || result.error?.toLowerCase().includes('not found')
      return NextResponse.json({ error: result.error || 'Agent loop failed' }, { status: isClientError ? 400 : 500 })
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

    return NextResponse.json({
      success: true,
      content: result.content,
      turns: result.turns,
      toolCalls: result.toolCalls,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
