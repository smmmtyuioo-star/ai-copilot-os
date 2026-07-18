import { NextRequest, NextResponse } from 'next/server'
import { generateId } from '@/lib/utils'
import { ok, fail, serverError } from '@/lib/api-utils'
import { getServerStore } from '@/lib/server-store'
import crypto from 'crypto'

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000 // 15 minutes

interface ServerUser {
  id: string
  email: string
  name: string
  passwordHash: string
  createdAt: string
  updatedAt: string
}

interface ResetToken {
  id: string
  email: string
  token: string
  expiresAt: string
  used: boolean
  createdAt: string
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `s_${salt}:${hash}`
}

function verifyPassword(password: string, stored: string): boolean {
  if (stored.startsWith('h_')) return false
  if (!stored.startsWith('s_')) return false
  const parts = stored.slice(2).split(':')
  if (parts.length !== 2) return false
  const [salt, hash] = parts
  const computed = crypto.scryptSync(password, salt, 64).toString('hex')
  return computed === hash
}

export async function POST(request: NextRequest) {
  try {
    const { email, name, password, action } = await request.json()
    if (!email || !password) return fail('Email and password are required', 400)
    if (password.length < 4) return fail('Password must be at least 4 characters', 400)

    const store = getServerStore()
    const normalizedEmail = email.toLowerCase().trim()

    // --- REQUEST PASSWORD RESET ---
    if (action === 'request-reset') {
      const users = store.list('users') as ServerUser[]
      const existing = users.find(u => u.email === normalizedEmail)
      if (!existing) return fail('No account found with this email', 404)

      // Invalidate any previous unused tokens for this email
      const allTokens = store.list('resetTokens') as ResetToken[]
      for (const t of allTokens) {
        if (t.email === normalizedEmail && !t.used) {
          store.update('resetTokens', t.id, { used: true })
        }
      }

      const token: ResetToken = {
        id: generateId(),
        email: normalizedEmail,
        token: crypto.randomUUID(),
        expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS).toISOString(),
        used: false,
        createdAt: new Date().toISOString(),
      }
      store.add('resetTokens', token)

      return ok({
        message: 'Reset link sent. Use the token below to reset your password.',
        token: token.token,
        expiresIn: '15 minutes',
      }, 'Reset token generated')
    }

    // --- RESET PASSWORD WITH TOKEN ---
    if (action === 'reset-password') {
      const { resetToken } = await request.json()
      if (!resetToken) return fail('Reset token is required', 400)

      const allTokens = store.list('resetTokens') as ResetToken[]
      const stored = allTokens.find(t => t.token === resetToken && t.email === normalizedEmail)
      if (!stored) return fail('Invalid reset token', 401)
      if (stored.used) return fail('Reset token has already been used', 401)
      if (new Date(stored.expiresAt).getTime() < Date.now()) return fail('Reset token has expired', 401)

      const users = store.list('users') as ServerUser[]
      const user = users.find(u => u.email === normalizedEmail)
      if (!user) return fail('User not found', 404)

      user.passwordHash = hashPassword(password)
      user.updatedAt = new Date().toISOString()
      store.update('users', user.id, user)
      store.update('resetTokens', stored.id, { used: true })

      return ok(null, 'Password updated successfully')
    }

    // --- LOGIN ---
    if (action === 'login') {
      const users = store.list('users') as ServerUser[]
      const existing = users.find(u => u.email === normalizedEmail)
      if (!existing) return fail('Invalid email or password', 401)
      if (!verifyPassword(password, existing.passwordHash)) return fail('Invalid email or password', 401)
      const session = {
        id: generateId(),
        userId: existing.id,
        email: existing.email,
        name: existing.name,
        expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
        createdAt: new Date().toISOString(),
      }
      store.add('sessions', session)
      return ok({ user: { id: existing.id, email: existing.email, name: existing.name }, token: session.id, expiresAt: session.expiresAt }, 'Login successful')
    }

    // --- REGISTER ---
    const users = store.list('users') as ServerUser[]
    if (users.some(u => u.email === normalizedEmail)) {
      return fail('User with this email already exists', 409)
    }

    const user: ServerUser = {
      id: generateId(),
      email: normalizedEmail,
      name: (name || normalizedEmail.split('@')[0]).trim(),
      passwordHash: hashPassword(password),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    store.add('users', user)

    const session = {
      id: generateId(),
      userId: user.id,
      email: user.email,
      name: user.name,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString(),
      createdAt: new Date().toISOString(),
    }
    store.add('sessions', session)
    return ok({ user: { id: user.id, email: user.email, name: user.name }, token: session.id, expiresAt: session.expiresAt }, 'User created')
  } catch (e) { return serverError(e) }
}

export async function PUT(request: NextRequest) {
  try {
    const { name, email, token } = await request.json()
    if (!token) return fail('Authentication token is required', 401)
    const store = getServerStore()
    const sessions = store.list('sessions')
    const session = sessions.find((s: any) => s.id === token)
    if (!session) return fail('Invalid or expired session', 401)
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      store.remove('sessions', token)
      return fail('Session expired', 401)
    }
    const users = store.list('users') as ServerUser[]
    const user = users.find(u => u.id === session.userId)
    if (!user) return fail('User not found', 404)
    if (name !== undefined) user.name = name
    if (email !== undefined) user.email = email.toLowerCase().trim()
    user.updatedAt = new Date().toISOString()
    store.update('users', user.id, user)
    return ok({ id: user.id, email: user.email, name: user.name, updatedAt: user.updatedAt }, 'User updated')
  } catch (e) { return serverError(e) }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    if (!token) return fail('Authentication token is required', 401)
    const store = getServerStore()
    const sessions = store.list('sessions')
    const session = sessions.find((s: any) => s.id === token)
    if (!session) return fail('Not authenticated', 401)
    if (new Date(session.expiresAt).getTime() < Date.now()) {
      store.remove('sessions', token)
      return fail('Session expired', 401)
    }
    return ok({ id: session.userId, email: session.email, name: session.name, expiresAt: session.expiresAt })
  } catch (e) { return serverError(e) }
}

export async function DELETE(request: NextRequest) {
  try {
    const { token } = await request.json()
    if (!token) return fail('Authentication token is required', 401)
    const store = getServerStore()
    store.remove('sessions', token)
    return ok(null, 'Signed out')
  } catch (e) { return serverError(e) }
}
