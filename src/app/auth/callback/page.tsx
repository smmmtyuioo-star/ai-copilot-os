'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Logo } from '@/components/ui/logo'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { getSupabase } from '@/database/client'
import { hasSupabase } from '@/lib/storage'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Verifying your email...')

  useEffect(() => {
    async function handleCallback() {
      if (!hasSupabase) {
        setStatus('error')
        setMessage('Supabase is not configured. Email verification is not available.')
        return
      }

      const supabase = getSupabase()
      if (!supabase) {
        setStatus('error')
        setMessage('Could not connect to authentication service.')
        return
      }

      const params = new URLSearchParams(window.location.search)
      const code = params.get('code')
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          setStatus('error')
          setMessage(error.message || 'Verification failed. The link may be expired.')
          return
        }
        setStatus('success')
        setMessage('Email verified! Redirecting...')
        setTimeout(() => router.push('/dashboard'), 1500)
        return
      }

      const tokenHash = params.get('token_hash')
      const type = params.get('type')
      if (tokenHash && type) {
        const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: type as any })
        if (error) {
          setStatus('error')
          setMessage(error.message || 'Verification failed.')
          return
        }
        setStatus('success')
        setMessage('Verified! Redirecting...')
        setTimeout(() => router.push('/dashboard'), 1500)
        return
      }

      setStatus('success')
      setMessage('Already verified. Redirecting...')
      setTimeout(() => router.push('/dashboard'), 1000)
    }
    handleCallback()
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <Logo className="mx-auto h-12 w-12 mb-4" />
        {status === 'loading' && <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600 mb-4" />}
        {status === 'success' && <CheckCircle2 className="mx-auto h-8 w-8 text-green-500 mb-4" />}
        {status === 'error' && <XCircle className="mx-auto h-8 w-8 text-red-500 mb-4" />}
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          {status === 'loading' ? 'Verifying...' : status === 'success' ? 'Success!' : 'Verification failed'}
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400">{message}</p>
        {status === 'error' && (
          <button onClick={() => router.push('/auth/login')}
            className="mt-6 text-sm font-medium text-blue-600 hover:text-blue-500">
            Back to login
          </button>
        )}
      </div>
    </div>
  )
}
