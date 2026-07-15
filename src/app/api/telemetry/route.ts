import { NextRequest, NextResponse } from 'next/server'
import { getToolStats, getSessionLogs } from '@/services/telemetry'

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')

  const stats = getToolStats(sessionId || undefined)
  const logs = sessionId ? getSessionLogs(sessionId) : undefined

  return NextResponse.json({ stats, logs, sessionId: sessionId || 'all' })
}
