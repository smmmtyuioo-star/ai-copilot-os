import { NextRequest, NextResponse } from 'next/server'
import { omniRoute, executeOmniRouteChat, executeOmniRouteStream, executeOmniRouteVerification, executeAgentConversation, enqueueOmniRouteTask, getOmniRouteTaskStatus, getOmniRouteQueueStatus } from '@/lib/omniroute'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mode = 'chat', ...config } = body

    switch (mode) {
      case 'chat': {
        const result = await executeOmniRouteChat(config)
        return NextResponse.json(result)
      }

      case 'stream': {
        const encoder = new TextEncoder()
        const stream = new ReadableStream({
          async start(controller) {
            try {
              for await (const chunk of executeOmniRouteStream(config)) {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`))
              }
              controller.enqueue(encoder.encode('data: [DONE]\n\n'))
              controller.close()
            } catch (err) {
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: err instanceof Error ? err.message : 'Stream error' })}\n\n`))
              controller.close()
            }
          },
        })
        return new Response(stream, {
          headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' },
        })
      }

      case 'verify': {
        const result = await executeOmniRouteVerification(config)
        return NextResponse.json(result)
      }

      case 'agents': {
        const result = await executeAgentConversation(config)
        return NextResponse.json(result)
      }

      case 'enqueue': {
        const taskId = enqueueOmniRouteTask(config)
        return NextResponse.json({ taskId, status: 'queued' })
      }

      case 'status': {
        if (config.taskId) {
          const task = getOmniRouteTaskStatus(config.taskId)
          if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
          return NextResponse.json(task)
        }
        return NextResponse.json(getOmniRouteQueueStatus())
      }

      default:
        return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 })
    }
  } catch (err) {
    console.error('OmniRoute API error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Execution failed' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    modes: ['chat', 'stream', 'verify', 'agents', 'enqueue', 'status'],
    description: 'OmniRoute API - Multi-model chat with verification, agent conversations, and task queue',
  })
}