'use client'
import { useState, useEffect, useRef } from 'react'
import { Loader2, CheckCircle2, AlertCircle, RefreshCw, Wifi, WifiOff, Search } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@/components/ui'

async function checkViaApi(): Promise<{ records: any[]; freeModels: any[] }> {
  const res = await fetch('/api/provider-health/check')
  if (!res.ok) throw new Error('Health check API failed')
  const data = await res.json()
  return { records: data.records || [], freeModels: data.freeModels || [] }
}

export default function ProviderHealthPage() {
  const [records, setRecords] = useState<any[]>([])
  const [freeModels, setFreeModels] = useState<any[]>([])
  const [checking, setChecking] = useState(false)
  const [lastChecked, setLastChecked] = useState<Date | null>(null)
  const [error, setError] = useState('')
  const [modelSearch, setModelSearch] = useState('')
  const monitorRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function runCheck() {
    setChecking(true)
    setError('')
    try {
      const apiResult = await checkViaApi()
      setRecords(apiResult.records)
      setFreeModels(apiResult.freeModels)
      setLastChecked(new Date())
    } catch (err) {
      console.error('Health check failed:', err)
      setError(err instanceof Error ? err.message : 'Health check failed')
    }
    setChecking(false)
  }

  useEffect(() => {
    runCheck()
    monitorRef.current = setInterval(runCheck, 10 * 60 * 1000)
    return () => { if (monitorRef.current) clearInterval(monitorRef.current) }
  }, [])

  const filteredModels = freeModels.filter(m =>
    !modelSearch || m.modelId.toLowerCase().includes(modelSearch.toLowerCase()) ||
    m.providerId.toLowerCase().includes(modelSearch.toLowerCase())
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Provider Health</h1>
          <p className="text-sm text-gray-500">Check which API keys work and which free models are available</p>
        </div>
        <Button onClick={runCheck} loading={checking}><RefreshCw className={`h-4 w-4 ${checking ? 'animate-spin' : ''}`} /> Re-check</Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-lg">{records.filter(r => r.status === 'healthy').length}</CardTitle><CardDescription>Healthy keys</CardDescription></CardHeader>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">{records.filter(r => r.status === 'unhealthy').length}</CardTitle><CardDescription>Unhealthy keys</CardDescription></CardHeader>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-lg">{freeModels.length}</CardTitle><CardDescription>Free models available</CardDescription></CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Key Status</CardTitle>
          <CardDescription>{lastChecked ? `Last checked: ${lastChecked.toLocaleTimeString()}. Auto re-checks every 10 min.` : 'Not yet checked'}</CardDescription>
        </CardHeader>
        <CardContent>
          {checking && records.length === 0 ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-blue-500" /></div>
          ) : (
            <div className="space-y-2">
              {records.map((rec, i) => {
                const healthy = rec.status === 'healthy'
                const unknown = rec.status === 'unknown'
                return (
                  <div key={i} className="flex items-center justify-between rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                    <div className="flex items-center gap-3">
                      {healthy ? <Wifi className="h-5 w-5 text-green-500" /> : <WifiOff className="h-5 w-5 text-red-400" />}
                      <div>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{rec.providerId}</p>
                        <p className="text-xs text-gray-500">{rec.keyFingerprint}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {healthy ? (
                        <Badge variant="success">Healthy</Badge>
                      ) : unknown ? (
                        <Badge variant="warning">Unknown</Badge>
                      ) : (
                        <Badge variant="error">Unhealthy</Badge>
                      )}
                      {rec.lastError && (
                        <span className="text-xs text-red-500 max-w-[200px] truncate" title={rec.lastError}>{rec.lastError}</span>
                      )}
                    </div>
                  </div>
                )
              })}
              {records.length === 0 && !checking && (
                <p className="text-sm text-gray-400 text-center py-4">No API keys found. Add keys in API Center or set environment variables.</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Available Free Models</CardTitle>
          <CardDescription>Only from keys that passed their most recent health check</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input value={modelSearch} onChange={e => setModelSearch(e.target.value)}
              placeholder="Search models..." className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm dark:border-gray-600 dark:bg-gray-800" />
          </div>
          {freeModels.length === 0 && !checking ? (
            <p className="text-sm text-gray-400 text-center py-4">No free models available from verified keys.</p>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {filteredModels.map((m, i) => (
                <div key={i} className="flex items-center gap-2 rounded-lg border border-gray-100 bg-gray-50 p-2 text-sm dark:border-gray-700 dark:bg-gray-900">
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-green-500" />
                  <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{m.providerId}</span>
                  <span className="text-xs text-gray-700 dark:text-gray-300 truncate">{m.modelId}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
