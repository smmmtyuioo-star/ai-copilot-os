'use client'
import { useState } from 'react'
import { Globe, Bot, MessageCircle, Plus, Trash2, CheckCircle2, AlertCircle, Webhook } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Modal, Input } from '@/components/ui'
import { webhookHandler } from '@/services/webhook-handler'
import type { WebhookMessage } from '@/services/webhook-handler'

const PLATFORMS = [
  { id: 'slack', name: 'Slack', icon: Bot, color: 'text-green-500' },
  { id: 'discord', name: 'Discord', icon: MessageCircle, color: 'text-indigo-500' },
  { id: 'generic', name: 'Generic Webhook', icon: Webhook, color: 'text-gray-500' },
]

export default function WebhooksPage() {
  const [platforms, setPlatforms] = useState<{ platform: string; webhookUrl: string; botName: string }[]>([])
  const [showConfig, setShowConfig] = useState(false)
  const [selectedPlatform, setSelectedPlatform] = useState('slack')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [botName, setBotName] = useState('AI Copilot OS')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  function addPlatform() {
    if (!webhookUrl.trim()) return
    const existing = platforms.findIndex(p => p.platform === selectedPlatform)
    const config = { platform: selectedPlatform, webhookUrl: webhookUrl.trim(), botName: botName.trim() || 'AI Copilot OS' }
    if (existing >= 0) {
      platforms[existing] = config
    } else {
      platforms.push(config)
    }
    webhookHandler.registerPlatform({ platform: selectedPlatform as 'slack' | 'discord' | 'generic', webhookUrl: config.webhookUrl, apiKey: '', botName: config.botName })
    setPlatforms([...platforms])
    setShowConfig(false)
    setWebhookUrl('')
    setMessage({ type: 'success', text: `${selectedPlatform} webhook configured!` })
    setTimeout(() => setMessage(null), 3000)
  }

  function removePlatform(platform: string) {
    setPlatforms(prev => prev.filter(p => p.platform !== platform))
    webhookHandler.unregisterPlatform(platform)
    setMessage({ type: 'success', text: `${platform} webhook removed` })
    setTimeout(() => setMessage(null), 3000)
  }

  async function testPlatform(platform: string) {
    const config = platforms.find(p => p.platform === platform)
    if (!config) return
    const sent = await webhookHandler.sendReply(
      { platform: platform as 'slack' | 'discord' | 'generic', webhookUrl: config.webhookUrl, apiKey: '', botName: config.botName },
      '',
      `Copilot OS is operational. Platform: ${platform}.`
    )
    setMessage({ type: sent ? 'success' : 'error', text: sent ? 'Test message sent!' : 'Failed to send test message' })
    setTimeout(() => setMessage(null), 3000)
  }

  const getPlatformInfo = (id: string) => PLATFORMS.find(p => p.id === id)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Webhooks & Chat</h1>
          <p className="text-sm text-gray-500">Connect AI Copilot OS to chat platforms</p>
        </div>
        <Button onClick={() => setShowConfig(true)}><Plus className="h-4 w-4" /> Add Webhook</Button>
      </div>

      {message && (
        <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {platforms.length === 0 ? (
          <Card className="md:col-span-2">
            <CardContent className="py-12 text-center">
              <Globe className="mx-auto h-8 w-8 text-gray-400" />
              <p className="mt-2 text-gray-500">No chat platforms configured yet.</p>
              <p className="text-xs text-gray-400">Add Slack, Discord, or a generic webhook to reach the copilot from chat.</p>
            </CardContent>
          </Card>
        ) : (
          platforms.map(p => {
            const info = getPlatformInfo(p.platform)
            const Icon = info?.icon || Webhook
            return (
              <Card key={p.platform}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className={`h-5 w-5 ${info?.color || ''}`} />
                      <div>
                        <CardTitle className="capitalize">{p.platform}</CardTitle>
                        <CardDescription>{p.botName}</CardDescription>
                      </div>
                    </div>
                    <Badge variant="success">Connected</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="truncate text-xs text-gray-500">{p.webhookUrl}</p>
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => testPlatform(p.platform)}>Test</Button>
                    <Button size="sm" variant="danger" onClick={() => removePlatform(p.platform)}>
                      <Trash2 className="h-4 w-4" /> Remove
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Endpoints</CardTitle>
          <CardDescription>Use these endpoints to reach the copilot from any surface</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-medium text-gray-700 dark:text-gray-300">Webhook Receiver</p>
            <code className="block rounded bg-gray-100 p-2 text-xs dark:bg-gray-800">POST /api/webhook</code>
            <p className="mt-1 text-xs text-gray-500">Accepts Slack, Discord, and generic webhook payloads.</p>
          </div>
          <div>
            <p className="font-medium text-gray-700 dark:text-gray-300">API Bridge (CLI / IDE / Desktop)</p>
            <code className="block rounded bg-gray-100 p-2 text-xs dark:bg-gray-800">POST /api/bridge</code>
            <p className="mt-1 text-xs text-gray-500">Unified API for external surfaces. Supports chat.send, code.execute, models.list, and status actions.</p>
          </div>
          <div>
            <p className="font-medium text-gray-700 dark:text-gray-300">CLI Usage</p>
            <pre className="overflow-x-auto rounded bg-gray-100 p-2 text-xs dark:bg-gray-800">{`curl -X POST http://localhost:3000/api/bridge \\
  -H "Content-Type: application/json" \\
  -d '{"surface":"cli","action":"chat.send","payload":{"message":"Hello"}}'`}</pre>
          </div>
        </CardContent>
      </Card>

      <Modal open={showConfig} onClose={() => setShowConfig(false)} title="Configure Webhook">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Platform</label>
            <select value={selectedPlatform} onChange={e => setSelectedPlatform(e.target.value)}
              className="w-full rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-800">
              {PLATFORMS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <Input id="webhook-url" label="Webhook URL" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://hooks.slack.com/services/..." />
          <Input id="bot-name" label="Bot Name" value={botName} onChange={e => setBotName(e.target.value)} placeholder="AI Copilot OS" />
          <p className="text-xs text-gray-400">Messages from the copilot will appear under this name in the chat platform.</p>
          <Button onClick={addPlatform} className="w-full" disabled={!webhookUrl.trim()}>
            <Plus className="h-4 w-4" /> Configure
          </Button>
        </div>
      </Modal>
    </div>
  )
}
