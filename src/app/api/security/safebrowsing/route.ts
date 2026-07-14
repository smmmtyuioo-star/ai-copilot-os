import { NextRequest, NextResponse } from 'next/server'
import { env } from '@/config/env'

export async function POST(request: NextRequest) {
  try {
    const { url, threatTypes } = await request.json()

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 })
    }

    if (!env.ai.googleSafeBrowsingKey) {
      return NextResponse.json({ error: 'Google Safe Browsing API key not configured' }, { status: 503 })
    }

    const response = await fetch(
      `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${env.ai.googleSafeBrowsingKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client: { clientId: 'ai-copilot-os', clientVersion: '1.0' },
          threatInfo: {
            threatTypes: threatTypes || ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
            platformTypes: ['ANY_PLATFORM'],
            threatEntryTypes: ['URL'],
            threatEntries: [{ url }],
          },
        }),
      }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      return NextResponse.json(
        { error: `Safe Browsing API error: ${error.error?.message || response.statusText}` },
        { status: response.status }
      )
    }

    const data = await response.json()
    const threats = data.matches || []

    return NextResponse.json({
      url,
      safe: threats.length === 0,
      threats: threats.map((t: any) => ({
        threatType: t.threatType,
        platformType: t.platformType,
        threatEntryType: t.threatEntryType,
        cacheDuration: t.cacheDuration,
      })),
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Safe Browsing error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Security check failed' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    provider: 'Google Safe Browsing',
    capabilities: ['url-check', 'malware-detection', 'phishing-detection', 'unwanted-software'],
    endpoint: '/api/security/safebrowsing',
    threatTypes: ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE', 'POTENTIALLY_HARMFUL_APPLICATION'],
  })
}