import { NextResponse } from 'next/server'

export function ok<T>(data: T, message?: string) {
  return NextResponse.json({ success: true, data, message })
}

export function fail(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status })
}

export function serverError(err: unknown) {
  const message = err instanceof Error ? err.message : 'Internal server error'
  return NextResponse.json({ success: false, error: message }, { status: 500 })
}
