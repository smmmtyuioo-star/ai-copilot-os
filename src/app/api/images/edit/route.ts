import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { image, editInstruction } = await request.json()

    if (!image || !editInstruction) {
      return NextResponse.json({ error: 'image and editInstruction are required' }, { status: 400 })
    }

    return NextResponse.json(
      {
        message: 'Image editing not available — requires a vision model API',
      },
      { status: 501 }
    )
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Image edit failed' },
      { status: 500 }
    )
  }
}
