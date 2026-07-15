import { NextRequest, NextResponse } from 'next/server'
import { executeCode } from '@/services/code-execution'

export async function POST(request: NextRequest) {
  try {
    const { code, language, timeout } = await request.json()

    if (!code || !language) {
      return NextResponse.json({ error: 'code and language are required' }, { status: 400 })
    }

    if (language !== 'javascript' && language !== 'typescript') {
      return NextResponse.json({ error: 'Unsupported language. Supported: javascript, typescript' }, { status: 400 })
    }

    const result = await executeCode({ code, language, timeout })

    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Code execution failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
