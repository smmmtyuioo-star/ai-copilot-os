'use client'
import { Brain, CreditCard, BarChart3, Shield, Zap, Users, ExternalLink } from 'lucide-react'

export default function BillingPage() {
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
        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
          🚧 Billing system is under development. All features are currently available for free.
          Subscribe to our newsletter for launch updates.
        </p>
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
              <button disabled className="mt-6 w-full rounded-xl bg-white px-4 py-2.5 text-sm font-medium text-gray-400 shadow-sm dark:bg-gray-800" title="Coming soon">
                Coming Soon
              </button>
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
