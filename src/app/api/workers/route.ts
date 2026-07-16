import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    {
      workers: [],
      message: 'Worker system not yet implemented',
    },
    { status: 501 }
  )
}
