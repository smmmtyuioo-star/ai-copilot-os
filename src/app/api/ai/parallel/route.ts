import { NextRequest, NextResponse } from 'next/server'
import { executeParallel, executeWithAggregation, getAvailableModels, getAllModels } from '@/lib/parallel-ai'

export async function GET() {
  return NextResponse.json({
    providers: getAvailableModels(),
    allModels: getAllModels(),
    taskTypes: ['coding', 'reasoning', 'speed', 'analysis', 'search', 'security', 'general'],
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mode = 'parallel', ...config } = body

    switch (mode) {
      case 'parallel': {
        const result = await executeParallel(config)
        return NextResponse.json(result)
      }
      case 'aggregated': {
        const result = await executeWithAggregation(config, config.aggregatorPrompt)
        return NextResponse.json(result)
      }
      case 'models': {
        return NextResponse.json(getAvailableModels())
      }
      default:
        return NextResponse.json({ error: `Unknown mode: ${mode}` }, { status: 400 })
    }
  } catch (err) {
    console.error('Parallel AI error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Execution failed' }, { status: 500 })
  }
}