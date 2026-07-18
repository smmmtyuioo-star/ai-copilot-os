'use client'
import { useState, useEffect } from 'react'
import { Brain, CreditCard, BarChart3, Shield, Zap, Users, ExternalLink, CheckCircle2, Mail, Loader2 } from 'lucide-react'

export default function BillingPage() {
  const [waitlistEmail, setWaitlistEmail] = useState('')
  const [waitlistSubmitted, setWaitlistSubmitted] = useState(false)
  const [waitlistSaving, setWaitlistSaving] = useState(false)

  useEffect(() => {
    const joined = localStorage.getItem('ac_waitlist_joined')
    if (joined) setWaitlistSubmitted(true)
  }, [])

  function joinWaitlist() {
    const email = waitlistEmail.trim()
    if (!email || !email.includes('@')) return
    setWaitlistSaving(true)
    try {
      const existing = JSON.parse(localStorage.getItem('ac_waitlist') || '[]')
      if (!existing.includes(email)) {
        existing.push(email)
        localStorage.setItem('ac_waitlist', JSON.stringify(existing))
      }
      localStorage.setItem('ac_waitlist_joined', 'true')
      setWaitlistSubmitted(true)
    } catch {}
    setWaitlistSaving(false)
  }

  const plans = [
    { name: 'Free', price: '$0', icon: Zap, features: ['50 messages/day', 'Groq free models', 'Local storage', 'Community support'], color: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
    { name: 'Pro', price: '$19', icon: BarChart3, features: ['Unlimited messages', 'All AI providers', 'Supabase sync', 'Priority support', 'Custom MCP endpoints'], color: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
    { name: 'Team', price: '$49', icon: Users, features: ['Everything in Pro', 'Team workspaces', 'Shared memory/knowledge', 'Admin controls', 'API access'], color: 'bg-purple-50 dark:bg-purple-900/20 border-purple-200 dark:border-purple-800' },
  ]

  return (
    <div className="mx-auto max-w-5xl px-4 py-12">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
          <CreditCard className="h-8 w-8 text-amber-600" />
        </div>
        <h1 className="text-3xl font-bold">Billing & Plans</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">Choose the plan that fits your needs</p>
      </div>

      <div className="mb-10 rounded-2xl border-2 border-amber-200 bg-amber-50 p-4 text-center dark:border-amber-800 dark:bg-amber-900/20">
        <p className="mb-3 text-sm font-medium text-amber-800 dark:text-amber-200">
          🚧 Billing system is under development. All features are currently available for free.
        </p>
        {waitlistSubmitted ? (
          <div className="flex items-center justify-center gap-2 text-sm text-green-700 dark:text-green-300">
            <CheckCircle2 className="h-4 w-4" />
            You&apos;re on the waitlist — we&apos;ll notify you at launch.
          </div>
        ) : (
          <div className="mx-auto flex max-w-md items-center gap-2">
            <input value={waitlistEmail} onChange={e => setWaitlistEmail(e.target.value)}
              placeholder="Enter your email for launch updates"
              className="flex-1 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400 dark:border-amber-700 dark:bg-amber-900/40 dark:text-white"
            />
            <button onClick={joinWaitlist} disabled={waitlistSaving || !waitlistEmail.includes('@')}
              className="flex items-center gap-1 rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50">
              {waitlistSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
              Join Waitlist
            </button>
          </div>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => {
          const Icon = plan.icon
          return (
            <div key={plan.name} className={`rounded-2xl border-2 p-6 ${plan.color}`}>
              <div className="mb-4 flex items-center justify-between">
                <Icon className="h-8 w-8 text-gray-700 dark:text-gray-300" />
                <span className="rounded-full bg-white px-3 py-1 text-xs font-medium dark:bg-gray-800">
                  {plan.name}
                </span>
              </div>
              <p className="text-3xl font-bold">{plan.price}<span className="text-sm font-normal text-gray-500">/mo</span></p>
              <ul className="mt-6 space-y-3">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/80 text-xs dark:bg-gray-800">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="mt-6 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-gray-400 shadow-sm dark:bg-gray-800 text-center">
                {plan.price === '$0' ? 'Current Plan' : 'Coming Soon'}
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-10 rounded-2xl border border-gray-200 p-6 dark:border-gray-700">
        <h2 className="font-semibold">Current Usage</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {[
            { label: 'Messages Today', value: '—', icon: Brain },
            { label: 'API Calls', value: '—', icon: BarChart3 },
            { label: 'Storage Used', value: '—', icon: Shield },
          ].map((stat) => {
            const Icon = stat.icon
            return (
              <div key={stat.label} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-700">
                <Icon className="h-8 w-8 text-gray-300 dark:text-gray-600" />
                <div>
                  <p className="text-xs text-gray-400">{stat.label}</p>
                  <p className="text-lg font-semibold text-gray-300 dark:text-gray-500">{stat.value}</p>
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-xs text-gray-400">Usage data will appear once billing is active.</p>
      </div>
    </div>
  )
}
