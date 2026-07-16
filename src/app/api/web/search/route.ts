import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { query, searchDepth, maxResults, includeAnswer, includeRawContent } = await request.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    const response = await fetch(new URL('/api/search/tavily', request.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, searchDepth, maxResults, includeAnswer, includeRawContent }),
    })

    const data = await response.json()

    return NextResponse.json(data, { status: response.status })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Search failed' },
      { status: 500 }
    )
  }
}
