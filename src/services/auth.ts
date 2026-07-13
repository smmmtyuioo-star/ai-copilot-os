import { getSupabase } from '@/database/client'
import type { User, Session } from '@/types'
import { parseError } from '@/lib/utils'

export interface AuthResult {
  success: boolean
  user?: User
  session?: Session
  error?: string
}

export async function signUp(email: string, password: string, name: string): Promise<AuthResult> {
  const supabase = getSupabase()
  if (!supabase) return { success: false, error: 'Client not available' }
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name } },
  })
  if (error) return { success: false, error: error.message }
  if (!data.user) return { success: false, error: 'Signup failed' }
  return {
    success: true,
    user: {
      id: data.user.id,
      email: data.user.email!,
      name: data.user.user_metadata.name || '',
      created_at: data.user.created_at,
      updated_at: data.user.updated_at || data.user.created_at,
    },
  }
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const supabase = getSupabase()
  if (!supabase) return { success: false, error: 'Client not available' }
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { success: false, error: error.message }
  if (!data.user) return { success: false, error: 'Login failed' }
  return {
    success: true,
    user: {
      id: data.user.id,
      email: data.user.email!,
      name: data.user.user_metadata.name || '',
      created_at: data.user.created_at,
      updated_at: data.user.updated_at || data.user.created_at,
    },
    session: data.session as unknown as Session,
  }
}

export async function signOut(): Promise<void> {
  const supabase = getSupabase()
  supabase?.auth.signOut()
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = getSupabase()
  if (!supabase) return null
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  return {
    id: user.id,
    email: user.email!,
    name: user.user_metadata.name || '',
      created_at: user.created_at,
      updated_at: user.updated_at || user.created_at,
  }
}

export async function resetPassword(email: string): Promise<AuthResult> {
  const supabase = getSupabase()
  if (!supabase) return { success: false, error: 'Client not available' }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  })
  if (error) return { success: false, error: error.message }
  return { success: true }
}

export async function updateProfile(data: Partial<User>): Promise<AuthResult> {
  try {
    const supabase = getSupabase()
    if (!supabase) return { success: false, error: 'Client not available' }
    const { error } = await supabase.auth.updateUser({ data })
    if (error) return { success: false, error: error.message }
    const user = await getCurrentUser()
    return { success: true, user: user || undefined }
  } catch (err) {
    return { success: false, error: parseError(err) }
  }
}
