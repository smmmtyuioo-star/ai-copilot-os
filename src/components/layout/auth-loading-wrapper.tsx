'use client'
import { useAuth } from '@/hooks/useAuth'
import { Loader2 } from 'lucide-react'

export function AuthLoadingWrapper({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    )
  }

  return <>{children}</>
}
