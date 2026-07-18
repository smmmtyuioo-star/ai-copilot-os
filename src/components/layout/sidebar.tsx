'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { Logo } from '@/components/ui/logo'
import {
  LayoutDashboard, MessageSquare, Bot, Globe,
  Brain, Plug, Puzzle, Network, Key, Settings, LogOut,
  FileText, Wand2, Play, Activity,
} from 'lucide-react'

const navItems = [
  { href: '/', label: 'Main Chat', icon: MessageSquare },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/chat', label: 'Chat (Dashboard)', icon: MessageSquare },
  { href: '/build', label: 'Build Pipeline', icon: Play },
  { href: '/agents', label: 'Agents', icon: Bot },
  { href: '/skills', label: 'Skills', icon: Wand2 },
  { href: '/plugins', label: 'Plugins', icon: Puzzle },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/browser', label: 'Browser', icon: Globe },
  { href: '/memory', label: 'Memory', icon: Brain },
  { href: '/prompts', label: 'Prompt Inspector', icon: Activity },
  { href: '/connectors', label: 'Connectors', icon: Plug },
  { href: '/mcp', label: 'MCP', icon: Network },
  { href: '/api-center', label: 'API Center', icon: Key },
  { href: '/provider-health', label: 'Provider Health', icon: Activity },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex h-14 items-center border-b border-gray-200 px-4 dark:border-gray-700">
          <Link href="/" className="flex items-center gap-2 font-bold text-gray-900 dark:text-gray-100">
            <Logo className="h-6 w-6" />
            <span>AI Copilot OS</span>
          </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        {navItems.map(item => {
          const Icon = item.icon
          const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                  : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800',
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-gray-200 p-3 dark:border-gray-700">
        <Link
          href="/settings"
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
        >
          <Settings className="h-5 w-5" />
          Settings
        </Link>
        {user && (
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        )}
      </div>
    </aside>
  )
}
