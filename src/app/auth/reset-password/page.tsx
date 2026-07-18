'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Logo } from '@/components/ui/logo'
import { ArrowLeft } from 'lucide-react'
import { Button, Input } from '@/components/ui'
import { getSupabase } from '@/database/client'
import { hasSupabase } from '@/lib/storage'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [mode, setMode] = useState<'supabase' | 'local'>('supabase')

  useEffect(() => {
    if (token) setMode('local')
  }, [token])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    if (mode === 'local') {
      try {
        const res = await fetch('/api/auth/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, action: 'reset-password', resetToken: token }),
        })
        const data = await res.json()
        if (!data.success) { setError(data.error || 'Reset failed'); setLoading(false); return }
        setDone(true)
        setTimeout(() => router.push('/auth/login'), 2000)
      } catch { setError('Network error') } finally { setLoading(false) }
      return
    }

    if (!hasSupabase) { setError('Supabase required for password reset'); setLoading(false); return }
    const supabase = getSupabase()
    if (!supabase) { setError('Auth unavailable'); setLoading(false); return }
    const { error: supaError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (supaError) { setError(supaError.message); return }
    setDone(true)
    setTimeout(() => router.push('/auth/login'), 2000)
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo className="mx-auto h-10 w-10" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">
            {done ? 'Password updated' : 'Reset your password'}
          </h1>
          {mode === 'local' && <p className="mt-1 text-xs text-gray-500">Using token-based reset</p>}
        </div>
        {done ? (
          <p className="text-center text-sm text-gray-600 dark:text-gray-400">Redirecting to login...</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
            {mode === 'local' && (
              <Input id="email" label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            )}
            <Input id="password" label="New Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
            <Button type="submit" className="w-full" loading={loading}>Update Password</Button>
          </form>
        )}
      </div>
    </div>
  )
}
