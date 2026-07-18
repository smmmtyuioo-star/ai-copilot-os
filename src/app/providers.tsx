'use client'
import { ThemeProvider } from 'next-themes'
import { AuthProvider } from '@/hooks/useAuth'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { OfflineProvider } from '@/components/offline-detector'

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <AuthProvider>
        <OfflineProvider>
          <ErrorBoundary>{children}</ErrorBoundary>
        </OfflineProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
