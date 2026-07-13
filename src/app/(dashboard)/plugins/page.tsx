'use client'
import { useState, useEffect } from 'react'
import { Puzzle, Download, Check, X } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { getSupabase } from '@/database/client'
import type { Plugin } from '@/types'
import { generateId } from '@/lib/utils'

const AVAILABLE_PLUGINS: Omit<Plugin, 'id'>[] = [
  { name: 'Code Analyzer', version: '1.0.0', description: 'Static code analysis for multiple languages', author: 'AI Copilot', verified: true, config_schema: {} },
  { name: 'Data Exporter', version: '1.0.0', description: 'Export data to CSV, JSON, and Excel', author: 'AI Copilot', verified: true, config_schema: {} },
  { name: 'Web Scraper', version: '1.0.0', description: 'Extract structured data from web pages', author: 'AI Copilot', verified: true, config_schema: {} },
  { name: 'PDF Generator', version: '1.0.0', description: 'Generate PDF documents from templates', author: 'AI Copilot', verified: true, config_schema: {} },
  { name: 'Image Analyzer', version: '0.9.0', description: 'Analyze images with AI vision', author: 'Community', verified: false, config_schema: {} },
]

export default function PluginsPage() {
  const { user } = useAuth()
  const [installed, setInstalled] = useState<Plugin[]>([])

  useEffect(() => { if (user) load() }, [user])

  async function load() {
    if (!user) return
    const supabase = getSupabase()
    if (!supabase) return
    const { data } = await supabase.from('plugins').select('*')
    setInstalled(data || [])
  }

  async function handleInstall(plugin: Omit<Plugin, 'id'>) {
    const item: Plugin = { ...plugin, id: generateId() }
    const supabase = getSupabase()
    if (!supabase) return
    const { error } = await supabase.from('plugins').insert(item)
    if (!error) setInstalled(prev => [...prev, item])
  }

  async function handleUninstall(id: string) {
    const supabase = getSupabase()
    if (supabase) await supabase.from('plugins').delete().eq('id', id)
    setInstalled(prev => prev.filter(p => p.id !== id))
  }

  const isInstalled = (name: string) => installed.some(p => p.name === name)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Plugins</h1>
        <p className="text-sm text-gray-500">Extend functionality with plugins</p>
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Installed ({installed.length})</h2>
        {installed.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center">
              <Puzzle className="mx-auto h-8 w-8 text-gray-400" />
              <p className="mt-2 text-gray-500">No plugins installed</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {installed.map(plugin => (
              <Card key={plugin.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle>{plugin.name}</CardTitle>
                    <Badge variant={plugin.verified ? 'success' : 'warning'}>
                      {plugin.verified ? 'Verified' : 'Unverified'}
                    </Badge>
                  </div>
                  <CardDescription>v{plugin.version} by {plugin.author}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{plugin.description}</p>
                  <Button size="sm" variant="danger" onClick={() => handleUninstall(plugin.id)}>
                    <X className="h-4 w-4" /> Uninstall
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Available</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {AVAILABLE_PLUGINS.filter(p => !isInstalled(p.name)).map((plugin, i) => (
            <Card key={i}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle>{plugin.name}</CardTitle>
                  <Badge variant={plugin.verified ? 'success' : 'warning'}>
                    {plugin.verified ? 'Verified' : 'Unverified'}
                  </Badge>
                </div>
                <CardDescription>v{plugin.version} by {plugin.author}</CardDescription>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">{plugin.description}</p>
                <Button size="sm" onClick={() => handleInstall(plugin)}>
                  <Download className="h-4 w-4" /> Install
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
