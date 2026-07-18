'use client'
import { useState, useEffect, createContext, useContext, useCallback, type ReactNode } from 'react'
import { Wifi, WifiOff } from 'lucide-react'

interface OfflineContextValue {
  isOffline: boolean
  registerDependency: (name: string) => void
  unregisterDependency: (name: string) => void
  dependencies: string[]
}

const OfflineContext = createContext<OfflineContextValue>({
  isOffline: false,
  registerDependency: () => {},
  unregisterDependency: () => {},
  dependencies: [],
})

export function useOffline() {
  return useContext(OfflineContext)
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  )
  const [dependencies, setDependencies] = useState<string[]>([])

  useEffect(() => {
    function handleOnline() { setIsOffline(false) }
    function handleOffline() { setIsOffline(true) }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const registerDependency = useCallback((name: string) => {
    setDependencies(prev => prev.includes(name) ? prev : [...prev, name])
  }, [])

  const unregisterDependency = useCallback((name: string) => {
    setDependencies(prev => prev.filter(n => n !== name))
  }, [])

  return (
    <OfflineContext.Provider value={{ isOffline, registerDependency, unregisterDependency, dependencies }}>
      {children}
    </OfflineContext.Provider>
  )
}

export function OfflineBanner() {
  const { isOffline } = useOffline()
  if (!isOffline) return null
  return (
    <div className="flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-sm text-white">
      <WifiOff className="h-4 w-4 shrink-0" />
      <span>You are offline. Network-dependent features (chat, search, tools) are unavailable until the connection is restored.</span>
    </div>
  )
}
