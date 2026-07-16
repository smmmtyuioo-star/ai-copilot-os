import { NextRequest, NextResponse } from 'next/server'
import { getToolStats, getSessionLogs } from '@/services/telemetry'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    const stats = getToolStats(sessionId || undefined)
    const logs = sessionId ? getSessionLogs(sessionId) : undefined

    const successRate = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0
    const topTools = Object.entries(stats.byTool)
      .sort(([, a], [, b]) => b.calls - a.calls)
      .slice(0, 5)
      .map(([name, s]) => ({ name, calls: s.calls, successRate: Math.round((s.success / s.calls) * 100) }))

    return NextResponse.json({
      success: true,
      stats: { total: stats.total, success: stats.success, failed: stats.failed, successRate, avgLatency: stats.avgLatency, topTools },
      logs: logs ? logs.slice(-100).map((l: any) => ({
        tool: l.tool, timestamp: l.timestamp, success: l.success,
        latencyMs: l.latencyMs,
      })) : undefined,
      sessionId: sessionId || 'all',
    })
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to read telemetry' }, { status: 500 })
  }
}
