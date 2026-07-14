'use client'
import { useAuth } from '@/hooks/useAuth'
import { useRouter } from 'next/navigation'
import { Moon, Sun, Bell, User, ArrowLeft, MessageSquare } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useState, useEffect } from 'react'

export function Header() {
  const { user } = useAuth()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  return (
    <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="flex items-center gap-2">
        <button onClick={() => router.back()} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800" title="Go back">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <button onClick={() => router.push('/')} className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30" title="Back to Chat">
          <MessageSquare className="h-4 w-4" /> Chat
        </button>
      </div>
      <div className="flex items-center gap-3">
        {mounted && (
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        )}
        <button className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800">
          <Bell className="h-5 w-5" />
        </button>
        {user && (
          <div className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300">
            <User className="h-5 w-5" />
            {user.name}
          </div>
        )}
      </div>
    </header>
  )
}
