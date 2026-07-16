import { NextRequest, NextResponse } from 'next/server'
import { generateId } from '@/lib/utils'
import { ok, fail, serverError } from '@/lib/api-utils'
import { localStore } from '@/lib/storage'

export async function POST(request: NextRequest) {
  try {
    if (typeof window === 'undefined') {
      return NextResponse.json({ error: 'This endpoint is client-side only', hint: 'Auth management is client-side only. User data is stored in localStorage.' }, { status: 501 })
    }
    const { email, name, password } = await request.json()
    if (!email || !password) return fail('Email and password are required')
    const user = {
      id: generateId(), email, name: name || email.split('@')[0],
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    if (typeof window !== 'undefined') localStorage.setItem('ac_user', JSON.stringify(user))
    return ok({ user, token: generateId() }, 'User created')
  } catch (e) { return serverError(e) }
}

export async function PUT(request: NextRequest) {
  try {
    if (typeof window === 'undefined') {
      return NextResponse.json({ error: 'This endpoint is client-side only', hint: 'Auth management is client-side only. User data is stored in localStorage.' }, { status: 501 })
    }
    const { name, email } = await request.json()
    const existing = typeof window !== 'undefined' ? localStorage.getItem('ac_user') : null
    if (!existing) return fail('No user found', 404)
    const user = JSON.parse(existing)
    if (name) user.name = name
    if (email) user.email = email
    user.updatedAt = new Date().toISOString()
    if (typeof window !== 'undefined') localStorage.setItem('ac_user', JSON.stringify(user))
    return ok(user, 'User updated')
  } catch (e) { return serverError(e) }
}

export async function GET() {
  try {
    if (typeof window === 'undefined') {
      return NextResponse.json({ error: 'This endpoint is client-side only', hint: 'Auth management is client-side only. User data is stored in localStorage.' }, { status: 501 })
    }
    const existing = typeof window !== 'undefined' ? localStorage.getItem('ac_user') : null
    if (!existing) return fail('Not authenticated', 401)
    return ok(JSON.parse(existing))
  } catch (e) { return serverError(e) }
}
