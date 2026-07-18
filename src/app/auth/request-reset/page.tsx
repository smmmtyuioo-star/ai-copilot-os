'use client'
import { useState } from 'react'
import Link from 'next/link'
import { Logo } from '@/components/ui/logo'
import { ArrowLeft, Copy, CheckCircle2 } from 'lucide-react'
import { Button, Input } from '@/components/ui'

export default function RequestResetPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resetToken, setResetToken] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'placeholder', action: 'request-reset' }),
      })
      const data = await res.json()
      if (!data.success) { setError(data.error || 'Request failed'); setLoading(false); return }
      setResetToken(data.data.token)
    } catch { setError('Network error'); } finally { setLoading(false) }
  }

  async function copyToken() {
    try { await navigator.clipboard.writeText(resetToken); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* noop */ }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo className="mx-auto h-10 w-10" />
          <h1 className="mt-4 text-2xl font-bold text-gray-900 dark:text-gray-100">Reset password</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Enter your email to receive a reset token</p>
        </div>
        {resetToken ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/30">
              <p className="text-sm text-green-700 dark:text-green-300">Reset token generated. Copy it and go to the reset page.</p>
            </div>
            <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-800">
              <code className="flex-1 break-all text-xs font-mono">{resetToken}</code>
              <button onClick={copyToken} className="shrink-0 rounded p-1.5 hover:bg-gray-200 dark:hover:bg-gray-700">
                {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4 text-gray-500" />}
              </button>
            </div>
            <Link href={`/auth/reset-password?token=${encodeURIComponent(resetToken)}`} className="block">
              <Button type="button" className="w-full">Continue to Reset Password</Button>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && <div className="rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>}
            <Input id="email" label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            <Button type="submit" className="w-full" loading={loading}>Send Reset Token</Button>
          </form>
        )}
        <div className="mt-6 text-center">
          <Link href="/auth/login" className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-500">
            <ArrowLeft className="h-3 w-3" /> Back to login
          </Link>
        </div>
      </div>
    </div>
  )
}
