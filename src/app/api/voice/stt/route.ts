import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { audio } = await request.json()

    if (!audio) {
      return NextResponse.json({ error: 'audio (base64) is required' }, { status: 400 })
    }

    return NextResponse.json(
      {
        text: 'Transcription not available — requires whisper or similar STT service',
      },
      { status: 501 }
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'STT failed' },
      { status: 500 }
    )
  }
}
