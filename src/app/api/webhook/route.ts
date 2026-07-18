import { NextRequest, NextResponse } from 'next/server'
import { webhookHandler } from '@/services/webhook-handler'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const platform = (body.platform as string) || 'generic'

    let result
    switch (platform) {
      case 'slack':
        result = await webhookHandler.handleSlackPayload(body)
        break
      case 'discord':
        result = await webhookHandler.handleDiscordPayload(body)
        break
      default:
        const { text, channel, user } = body
        result = await webhookHandler.handleMessage(platform, {
          platform,
          channel,
          user,
          text: text || '',
          raw: body,
          timestamp: new Date().toISOString(),
        })
    }

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Webhook processing failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET() {
  const status = await webhookHandler.handleStatusCheck()
  return NextResponse.json(status)
}
