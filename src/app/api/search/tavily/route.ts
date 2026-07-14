import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/config/env'

export async function POST(request: NextRequest) {
  try {
    const { query, searchDepth = 'advanced', maxResults = 5, includeAnswer = true, includeRawContent = false } = await request.json()

    if (!query) {
      return NextResponse.json({ error: 'Query is required' }, { status: 400 })
    }

    if (!env.ai.tavilyKey) {
      return NextResponse.json({ error: 'Tavily API key not configured' }, { status: 503 })
    }

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${env.ai.tavilyKey}`,
      },
      body: JSON.stringify({
        query,
        search_depth: searchDepth,
        max_results: maxResults,
        include_answer: includeAnswer,
        include_raw_content: includeRawContent,
        includeRawContent,
      }),
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: `Tavily API error: ${error.error?.message || response.statusText}` },
        { status: response.status }
      )
    }

    const data = await response.json()

    return NextResponse.json({
      query: data.query,
      answer: data.answer,
      results: data.results?.map((r: any) => ({
        title: r.title,
        content: r.content,
        url: r.url,
        score: r.score,
        rawContent: r.raw_content,
      })) || [],
      followUpQuestions: data.follow_up_questions,
      responseTime: data.response_time,
    })
  } catch (err) {
    console.error('Tavily search error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Search failed' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    provider: 'Tavily',
    capabilities: ['search', 'extract', 'real-time-data', 'citations'],
    endpoint: '/api/search/tavily',
  })
}