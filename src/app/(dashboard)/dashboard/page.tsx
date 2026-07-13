'use client'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { MessageSquare, Workflow, Bot, Brain, Activity, Users } from 'lucide-react'

export default function DashboardPage() {
  const { user } = useAuth()

  const stats = [
    { icon: MessageSquare, label: 'Conversations', value: '0', desc: 'Total chat conversations' },
    { icon: Workflow, label: 'Active Workflows', value: '0', desc: 'Running automations' },
    { icon: Bot, label: 'AI Agents', value: '0', desc: 'Configured agents' },
    { icon: Brain, label: 'Memory Entries', value: '0', desc: 'Stored memories' },
    { icon: Activity, label: 'API Calls', value: '0', desc: 'Today' },
    { icon: Users, label: 'Active Users', value: '1', desc: 'Current workspace' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Welcome{user ? `, ${user.name}` : ''}
        </h1>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Here's what's happening in your AI Copilot OS
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat, i) => {
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
              { label: 'Create Workflow', href: '/workflows', desc: 'Automate a process' },
              { label: 'Configure Agents', href: '/agents', desc: 'Set up multi-agent pipeline' },
              { label: 'Add Connector', href: '/connectors', desc: 'Connect external service' },
            ].map((item, i) => (
              <a
                key={i}
                href={item.href}
                className="flex items-center justify-between rounded-lg border border-gray-200 p-4 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
              >
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{item.label}</p>
                  <p className="text-sm text-gray-500">{item.desc}</p>
                </div>
                <span className="text-gray-400">→</span>
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
              { label: 'AI Models', status: 'Available', variant: 'success' as const },
              { label: 'Database', status: 'Connected', variant: 'success' as const },
              { label: 'Storage', status: 'Active', variant: 'success' as const },
              { label: 'Authentication', status: 'Operational', variant: 'success' as const },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
                <span className={`text-sm ${
                  item.variant === 'success' ? 'text-green-600' : 'text-red-600'
                }`}>{item.status}</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
