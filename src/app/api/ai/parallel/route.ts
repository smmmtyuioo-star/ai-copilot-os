import { NextRequest, NextResponse } from 'next/server'
import { executeParallel, executeWithAggregation, getAvailableModels, type ParallelExecutionConfig } from '@/lib/parallel-ai'

export async function GET() {
  return NextResponse.json({ models: getAvailableModels() })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mode = 'parallel', ...config } = body as ParallelExecutionConfig & { mode?: string; aggregatorPrompt?: string }

    if (!config.prompt || !config.models?.length) {
      return NextResponse.json({ error: 'prompt and models array are required' }, { status: 400 })
    }

    const validModels = config.models.filter(m => {
      const available = getAvailableModels()
      return available[m.provider]?.includes(m.model)
    })

    if (validModels.length === 0) {
      return NextResponse.json({ error: 'No valid models with configured API keys' }, { status: 400 })
    }

    const result = mode === 'aggregated'
      ? await executeWithAggregation({ ...config, models: validModels }, config.aggregatorPrompt)
      : await executeParallel({ ...config, models: validModels })

    return NextResponse.json(result)
  } catch (err) {
    console.error('Parallel AI error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Execution failed' },
      { status: 500 }
    )
  }
}