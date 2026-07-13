import { createBrowserClient } from '@supabase/ssr'
import { env } from '@/config/env'

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (!client) {
    if (!env.supabase.url || !env.supabase.anonKey) {
      throw new Error(
        'Supabase URL and Anon Key are required. ' +
        'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.',
      )
    }
    client = createBrowserClient(env.supabase.url, env.supabase.anonKey)
  }
  return client
}

export function getSupabase() {
  if (typeof window === 'undefined') return null
  return createClient()
}
