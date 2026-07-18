'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui'
import { Input } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'

declare global {
  interface Window { turnstile?: any }
}

const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || ''

export default function SignupPage() {
  const router = useRouter()
  const { register } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')
  const [turnstileReady, setTurnstileReady] = useState(false)
  const turnstileRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) { setTurnstileReady(true); return }
    if (document.getElementById('cf-turnstile-script')) return

    const script = document.createElement('script')
    script.id = 'cf-turnstile-script'
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad'
    script.async = true
    script.defer = true
    ;(window as any).onTurnstileLoad = () => {
      if (turnstileRef.current && window.turnstile) {
        widgetId.current = window.turnstile.render(turnstileRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (token: string) => { setTurnstileToken(token); setTurnstileReady(true) },
        })
      }
    }
    document.head.appendChild(script)

    return () => {
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current)
      }
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (TURNSTILE_SITE_KEY && !turnstileToken) {
      setError('Please complete the security check')
      return
    }

    setLoading(true)

    if (TURNSTILE_SITE_KEY) {
      const verifyRes = await fetch('/api/auth/verify-turnstile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: turnstileToken }),
      })
      const verifyData = await verifyRes.json()
      if (!verifyData.success) {
        setError('Security check failed. Please try again.')
        setLoading(false)
        if (widgetId.current && window.turnstile) window.turnstile.reset(widgetId.current)
        setTurnstileToken('')
        return
      }
    }

    const result = await register(email, password, name)
    setLoading(false)
    if (result.success) {
      router.push('/dashboard')
    } else {
      setError(result.error || 'Signup failed')
    }
  }

  const siteKey = TURNSTILE_SITE_KEY

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo className="mx-auto h-10 w-10" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">Create your account</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Start building with AI Copilot OS</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/50 dark:text-red-200">
              {error}
            </div>
          )}
          <Input id="name" label="Name" type="text" value={name} onChange={e => setName(e.target.value)} required />
          <Input id="email" label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <Input id="password" label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} />
          {siteKey && (
            <div ref={turnstileRef} className="flex justify-center [&>iframe]:!w-full [&>iframe]:!max-w-[300px]" />
          )}
          <Button type="submit" className="w-full" loading={loading} disabled={loading || (!!siteKey && !turnstileReady)}>
            Create Account
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-medium text-blue-600 hover:text-blue-500">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
