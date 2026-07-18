'use client'
import { useState, useEffect, createContext, useContext, useCallback, useRef, type ReactNode } from 'react'
import { Wifi, WifiOff, Send, Trash2 } from 'lucide-react'

interface QueuedMessage {
  id: string
  content: string
  timestamp: number
}

interface OfflineContextValue {
  isOffline: boolean
  registerDependency: (name: string) => void
  unregisterDependency: (name: string) => void
  dependencies: string[]
  queueMessage: (content: string) => void
  queuedMessages: QueuedMessage[]
  flushQueue: () => void
  clearQueue: () => void
}

const OfflineContext = createContext<OfflineContextValue>({
  isOffline: false,
  registerDependency: () => {},
  unregisterDependency: () => {},
  dependencies: [],
  queueMessage: () => {},
  queuedMessages: [],
  flushQueue: () => {},
  clearQueue: () => {},
})

export function useOffline() {
  return useContext(OfflineContext)
}

export function OfflineProvider({ children }: { children: ReactNode }) {
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false,
  )
  const [dependencies, setDependencies] = useState<string[]>([])
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([])
  const flushHandlerRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    function handleOnline() {
      setIsOffline(false)
    }
    function handleOffline() {
      setIsOffline(true)
    }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  const queueMessage = useCallback((content: string) => {
    const msg: QueuedMessage = {
      id: `offline_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      content: content.slice(0, 200),
      timestamp: Date.now(),
    }
    setQueuedMessages(prev => [...prev, msg])
  }, [])

  const clearQueue = useCallback(() => {
    setQueuedMessages([])
  }, [])

  const flushQueue = useCallback(() => {
    setQueuedMessages([])
  }, [])

  const registerDependency = useCallback((name: string) => {
    setDependencies(prev => prev.includes(name) ? prev : [...prev, name])
  }, [])

  const unregisterDependency = useCallback((name: string) => {
    setDependencies(prev => prev.filter(n => n !== name))
  }, [])

  return (
    <OfflineContext.Provider value={{
      isOffline, registerDependency, unregisterDependency, dependencies,
      queueMessage, queuedMessages, flushQueue, clearQueue,
    }}>
      {children}
    </OfflineContext.Provider>
  )
}

export function OfflineBanner() {
  const { isOffline, queuedMessages, flushQueue, clearQueue } = useOffline()
  if (!isOffline && queuedMessages.length === 0) return null

  return (
    <div className="space-y-1">
      {isOffline && (
        <div className="flex items-center justify-center gap-2 bg-red-600 px-4 py-2 text-sm text-white">
          <WifiOff className="h-4 w-4 shrink-0" />
          <span>You are offline. Network-dependent features (chat, search, tools) are unavailable until the connection is restored.</span>
        </div>
      )}
      {queuedMessages.length > 0 && !isOffline && (
        <div className="flex items-center justify-between gap-2 bg-amber-500 px-4 py-2 text-sm text-white">
          <div className="flex items-center gap-2">
            <Send className="h-4 w-4 shrink-0" />
            <span>{queuedMessages.length} message{queuedMessages.length > 1 ? 's' : ''} queued while offline. Send now?</span>
          </div>
          <div className="flex gap-2">
            <button onClick={flushQueue}
              className="rounded bg-white px-3 py-1 text-xs font-medium text-amber-700 hover:bg-amber-50">
              Send All
            </button>
            <button onClick={clearQueue}
              className="rounded bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700">
              Discard
            </button>
          </div>
        </div>
      )}
      {queuedMessages.length > 0 && isOffline && (
        <div className="flex items-center gap-2 bg-amber-600 px-4 py-1.5 text-xs text-white">
          <Send className="h-3 w-3 shrink-0" />
          <span>{queuedMessages.length} message{queuedMessages.length > 1 ? 's' : ''} queued — will send when back online</span>
        </div>
      )}
    </div>
  )
}
