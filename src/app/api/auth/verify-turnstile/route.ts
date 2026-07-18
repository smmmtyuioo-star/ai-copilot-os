import { NextRequest, NextResponse } from 'next/server'

const TURNSTILE_SECRET_KEY = process.env.TURNSTILE_SECRET_KEY || ''

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    if (!token) {
      return NextResponse.json({ success: false, error: 'Token is required' }, { status: 400 })
    }

    if (!TURNSTILE_SECRET_KEY) {
      return NextResponse.json({ success: false, error: 'Turnstile not configured' }, { status: 500 })
    }

    const formData = new URLSearchParams()
    formData.append('secret', TURNSTILE_SECRET_KEY)
    formData.append('response', token)

    const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: formData,
    })

    const data = await verifyRes.json()

    if (!data.success) {
      return NextResponse.json({ success: false, error: data['error-codes']?.[0] || 'Verification failed' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: false, error: 'Verification failed' }, { status: 500 })
  }
}
