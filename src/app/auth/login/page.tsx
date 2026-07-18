'use client'
import { Suspense } from 'react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui'
import { Input } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'

const LoginScene = dynamic(() => import('@/components/shared/login-scene'), { ssr: false })

export default function LoginPage() {
  const router = useRouter()
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await login(email, password)
    setLoading(false)
    if (result.success) {
      router.push('/dashboard')
    } else {
      setError(result.error || 'Login failed')
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      <Suspense fallback={null}>
        <LoginScene />
      </Suspense>
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-white/20 bg-white/10 p-8 backdrop-blur-xl dark:bg-gray-900/20 dark:border-gray-200/10" style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.15)' }}>
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Welcome back</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">Sign in to AI Copilot OS</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50/90 p-3 text-sm text-red-600 backdrop-blur-sm dark:bg-red-900/50 dark:text-red-200">
              {error}
            </div>
          )}
          <Input id="email" label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <Input id="password" label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          <div className="flex items-center justify-end">
            <Link href="/auth/request-reset" className="text-xs text-blue-600 hover:text-blue-500 hover:underline">Forgot password?</Link>
          </div>
          <Button type="submit" className="w-full" loading={loading}>Sign In</Button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Don't have an account?{' '}
          <Link href="/auth/signup" className="font-medium text-blue-600 hover:text-blue-500">Sign up</Link>
        </p>
      </div>
    </div>
  )
}
