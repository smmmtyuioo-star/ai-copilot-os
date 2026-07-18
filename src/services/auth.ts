import { getSupabase } from '@/database/client'
import { hasSupabase } from '@/lib/storage'
import type { User, Session } from '@/types'
import { parseError, generateId } from '@/lib/utils'

export interface AuthResult {
  success: boolean
  user?: User
  session?: Session
  error?: string
}

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

interface StoredSession { user: User; expiresAt: number }

function getLocalUser(): User | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = localStorage.getItem('ac_user')
    if (!raw) return null
    const session: StoredSession = JSON.parse(raw)
    if (Date.now() > session.expiresAt) {
      localStorage.removeItem('ac_user')
      return null
    }
    return session.user
  } catch (e) { console.error('Auth: failed to read local user:', e); return null }
}

function setLocalUser(user: User): void {
  if (typeof window === 'undefined') return
  const session: StoredSession = { user, expiresAt: Date.now() + SESSION_DURATION_MS }
  localStorage.setItem('ac_user', JSON.stringify(session))
}

function clearLocalUser(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem('ac_user')
}

export async function signUp(email: string, password: string, name: string): Promise<AuthResult> {
  if (hasSupabase) {
    const supabase = getSupabase()
    if (supabase) {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { data: { name } },
      })
      if (error) return { success: false, error: error.message }
      if (!data.user) return { success: false, error: 'Signup failed' }
      const user: User = {
        id: data.user.id, email: data.user.email!, name: data.user.user_metadata.name || '',
        created_at: data.user.created_at, updated_at: data.user.updated_at || data.user.created_at,
      }
      return { success: true, user }
    }
  }
  // Local fallback — call the server API route for proper password hashing
  if (!email || !password || !name) return { success: false, error: 'Email, password, and name are required' }
  try {
    const res = await fetch('/api/auth/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, action: 'register' }),
    })
    const data = await res.json()
    if (!data.success) return { success: false, error: data.error || 'Registration failed' }
    const user: User = {
      id: data.user.id, email: data.user.email, name: data.user.name,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    setLocalUser(user)
    return { success: true, user }
  } catch {
    return { success: false, error: 'Network error — could not reach server' }
  }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  if (hasSupabase) {
    const supabase = getSupabase()
    if (supabase) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { success: false, error: error.message }
      if (!data.user) return { success: false, error: 'Login failed' }
      const user: User = {
        id: data.user.id, email: data.user.email!, name: data.user.user_metadata.name || '',
        created_at: data.user.created_at, updated_at: data.user.updated_at || data.user.created_at,
      }
      return { success: true, user, session: data.session as unknown as Session }
    }
  }
  // Local fallback — call the server API route which verifies password hash
  if (!email || !password) return { success: false, error: 'Email and password are required' }
  try {
    const res = await fetch('/api/auth/user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, action: 'login' }),
    })
    const data = await res.json()
    if (!data.success) return { success: false, error: data.error || 'Invalid email or password' }
    const user: User = {
      id: data.user.id, email: data.user.email, name: data.user.name,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    setLocalUser(user)
    return { success: true, user }
  } catch {
    return { success: false, error: 'Network error — could not reach server' }
  }
}

export async function signOut(): Promise<void> {
  if (hasSupabase) {
    const supabase = getSupabase()
    await supabase?.auth.signOut()
  }
  clearLocalUser()
}

export async function getCurrentUser(): Promise<User | null> {
  if (hasSupabase) {
    const supabase = getSupabase()
    if (supabase) {
      const { data } = await supabase.auth.getUser()
      const user = data?.user
      if (user) {
        return {
          id: user.id, email: user.email!, name: user.user_metadata.name || '',
          created_at: user.created_at, updated_at: user.updated_at || user.created_at,
        }
      }
    }
  }
  return getLocalUser()
}

export async function resetPassword(email: string): Promise<AuthResult> {
  if (hasSupabase) {
    const supabase = getSupabase()
    if (supabase) {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })
      if (error) return { success: false, error: error.message }
      return { success: true }
    }
  }
  return { success: false, error: 'Supabase required for password reset' }
}

export async function updateProfile(data: Partial<User>): Promise<AuthResult> {
  try {
    if (hasSupabase) {
      const supabase = getSupabase()
      if (supabase) {
        const { error } = await supabase.auth.updateUser({ data })
        if (error) return { success: false, error: error.message }
        const user = await getCurrentUser()
        return { success: true, user: user || undefined }
      }
    }
    const existing = getLocalUser()
    if (existing) {
      const updated = { ...existing, ...data, updated_at: new Date().toISOString() }
      setLocalUser(updated)
      return { success: true, user: updated }
    }
    return { success: false, error: 'No user found' }
  } catch (err) {
    return { success: false, error: parseError(err) }
  }
}
