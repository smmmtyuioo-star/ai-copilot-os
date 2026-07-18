'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Logo } from '@/components/ui/logo'
import { Button } from '@/components/ui'
import { Input } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'

export default function SignupPage() {
  const router = useRouter()
  const { register } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const result = await register(email, password, name)
    setLoading(false)
    if (result.success) {
      router.push('/dashboard')
    } else {
      setError(result.error || 'Signup failed')
    }
  }

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
          <Button type="submit" className="w-full" loading={loading}>Create Account</Button>
        </form>
        <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
          Already have an account?{' '}
          <Link href="/auth/login" className="font-medium text-blue-600 hover:text-blue-500">Sign in</Link>
        </p>
      </div>
    </div>
  )
}
