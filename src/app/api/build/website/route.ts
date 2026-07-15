import { NextRequest, NextResponse } from 'next/server'
import { buildWebsite } from '@/services/website-builder'

export async function POST(request: NextRequest) {
  try {
    const { description, type, userId } = await request.json()
    if (!description) {
      return NextResponse.json({ success: false, error: 'Description is required' }, { status: 400 })
    }
    const result = await buildWebsite({ description, type, userId })
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Internal server error' }, { status: 500 })
  }
}
