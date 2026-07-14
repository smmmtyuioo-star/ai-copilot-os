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

function getLocalUser(): User | null {
  if (typeof window === 'undefined') return null
  try {
    const data = localStorage.getItem('ac_user')
    return data ? JSON.parse(data) : null
  } catch { return null }
}

function setLocalUser(user: User): void {
  if (typeof window === 'undefined') return
  localStorage.setItem('ac_user', JSON.stringify(user))
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
  // Local fallback
  if (!email || !password || !name) return { success: false, error: 'Email, password, and name are required' }
  const user: User = {
    id: generateId(), email, name,
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }
  setLocalUser(user)
  return { success: true, user }
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
  // Local fallback
  if (!email || !password) return { success: false, error: 'Email and password are required' }
  const existing = getLocalUser()
  if (existing && existing.email === email) {
    return { success: true, user: existing }
  }
  const user: User = {
    id: generateId(), email, name: email.split('@')[0],
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  }
  setLocalUser(user)
  return { success: true, user }
}

export async function signOut(): Promise<void> {
  if (hasSupabase) {
    const supabase = getSupabase()
    supabase?.auth.signOut()
  }
  clearLocalUser()
}

export async function getCurrentUser(): Promise<User | null> {
  if (hasSupabase) {
    const supabase = getSupabase()
    if (supabase) {
      const { data: { user } } = await supabase.auth.getUser()
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
