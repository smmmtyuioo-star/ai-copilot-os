'use client'
import { useState, useEffect } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { localStore, hasSupabase } from '@/lib/storage'
import { MessageSquare, Bot, Brain, Activity, Users, Zap } from 'lucide-react'

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState({ conversations: 0, agents: 0, memories: 0 })

  useEffect(() => {
    const convs = localStore.conversations.items.length
    const agents = localStore.agents.items.length
    const mems = localStore.memories.items.length
    setStats({ conversations: convs, agents: agents, memories: mems })
  }, [])

  const statItems = [
    { icon: MessageSquare, label: 'Conversations', value: String(stats.conversations), desc: 'Total chat conversations' },
    { icon: Bot, label: 'AI Agents', value: String(stats.agents), desc: 'Configured agents' },
    { icon: Brain, label: 'Memory Entries', value: String(stats.memories), desc: 'Stored memories' },
    { icon: Activity, label: 'API Calls', value: 'N/A', desc: 'Today' },
    { icon: Zap, label: 'Active Tasks', value: String(stats.agents), desc: 'Running automations' },
    { icon: Users, label: 'Active Users', value: '1', desc: 'Current workspace' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Welcome{user ? `, ${user.name}` : ''}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Here&apos;s what&apos;s happening in your AI Copilot OS
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {statItems.map((stat, i) => {
          const Icon = stat.icon
          return (
            <Card key={i}>
              <CardContent className="flex items-start gap-4">
                <div className="rounded-lg bg-blue-50 p-3 dark:bg-blue-900/30">
                  <Icon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stat.value}</p>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{stat.label}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{stat.desc}</p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Start common tasks</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'New Chat', href: '/chat', desc: 'Start an AI conversation' },
              { label: 'Build Pipeline', href: '/build', desc: 'Build from scratch' },
              { label: 'Configure Agents', href: '/agents', desc: 'Set up multi-agent pipeline' },
              { label: 'Add Connector', href: '/connectors', desc: 'Connect external service' },
            ].map((item, i) => (
              <a key={i} href={item.href}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800">
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{item.label}</p>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
                <span className="text-gray-400">&rarr;</span>
              </a>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>Service health and metrics</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'AI Models', status: hasSupabase ? 'Connected (Supabase)' : 'Available (Local)', variant: 'success' as const },
              { label: 'Database', status: hasSupabase ? 'Connected' : 'Local Storage', variant: 'success' as const },
              { label: 'Storage', status: 'Active', variant: 'success' as const },
              { label: 'Authentication', status: hasSupabase ? 'Supabase Auth' : 'Local', variant: 'success' as const },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
                <span className={`text-sm ${item.variant === 'success' ? 'text-green-600' : 'text-red-600'}`}>{item.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
