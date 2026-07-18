'use client'
import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui'
import { Input } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { updateProfile } from '@/services/auth'

const MODELS = [
  { provider: 'groq', label: 'Groq', models: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B' },
  ]},
  { provider: 'mistral', label: 'Mistral', models: [
    { id: 'mistral-medium', name: 'Mistral Medium' },
    { id: 'mistral-small', name: 'Mistral Small' },
  ]},
  { provider: 'openrouter', label: 'OpenRouter', models: [
    { id: 'openai/gpt-4o', name: 'GPT-4o' },
    { id: 'meta-llama/llama-3.3-70b-instruct', name: 'Llama 3.3 70B' },
  ]},
  { provider: 'nvidia', label: 'NVIDIA', models: [
    { id: 'nvidia/nemotron-3-ultra-550b-a55b', name: 'Nemotron 3 Ultra 550B' },
    { id: 'deepseek-ai/deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
  ]},
  { provider: 'cloudflare', label: 'Cloudflare', models: [
    { id: '@cf/meta/llama-3.1-8b-instruct-fp8', name: 'Llama 3.1 8B FP8' },
    { id: '@cf/meta/llama-3.2-3b-instruct', name: 'Llama 3.2 3B' },
  ]},
]

export default function SettingsPage() {
  const { user, loading } = useAuth()
  const { theme, setTheme } = useTheme()
  const [name, setName] = useState(user?.name || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const [error, setError] = useState('')
  const [selectedModel, setSelectedModel] = useState(() => {
    if (typeof window === 'undefined') return ''
    return localStorage.getItem('ac_default_model') || 'llama-3.3-70b-versatile'
  })

  useEffect(() => {
    localStorage.setItem('ac_default_model', selectedModel)
  }, [selectedModel])

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    setError('')
    const result = await updateProfile({ name })
    setSaving(false)
    if (result.success) { setSaved(true); setTimeout(() => setSaved(false), 3000) }
    else setError(result.error || 'Failed to save profile')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Settings</h1>
        <p className="text-sm text-gray-500">Manage your account and preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>Update your personal information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Input id="email" label="Email" type="email" value={user?.email || ''} disabled />
          <Input id="name" label="Name" type="text" value={name} onChange={e => setName(e.target.value)} />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <Button onClick={handleSave} loading={saving}>
            {saved ? 'Saved!' : 'Save Changes'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Configuration</CardTitle>
          <CardDescription>Choose your AI provider and model</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Provider</label>
            <p className="mt-1 text-xs text-gray-500">
              Set <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">OPENAI_API_KEY</code> or{' '}
              <code className="rounded bg-gray-100 px-1 dark:bg-gray-700">GROQ_API_KEY</code> in your .env.local
            </p>
          </div>
          {MODELS.map(group => (
            <div key={group.provider}>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-2">{group.label}</p>
              <div className="flex flex-wrap gap-2">
                {group.models.map(m => (
                  <button key={m.id} onClick={() => setSelectedModel(m.id)}
                    className={`rounded-lg border px-3 py-1.5 text-xs ${
                      selectedModel === m.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'border-gray-300 text-gray-600 hover:border-gray-400 dark:border-gray-600 dark:text-gray-400'
                    }`}>
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Theme</CardTitle>
          <CardDescription>Choose your preferred appearance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {['light', 'dark', 'system'].map(mode => (
            <label key={mode} className="flex items-center gap-3 cursor-pointer">
              <input type="radio" name="theme" value={mode}
                checked={theme === mode}
                onChange={() => setTheme(mode)}
                className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">{mode}</span>
            </label>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About</CardTitle>
          <CardDescription>AI Copilot OS • Built by Rishav • Real AI. Real Build. Real Preview.</CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-gray-400 space-y-1">
          <p>A full-stack AI copilot platform with multi-provider chat, agent loop, code execution, image generation, and more.</p>
          <p className="pt-1">Built with Next.js, Three.js, and a passion for AI tooling.</p>
        </CardContent>
      </Card>
    </div>
  )
}
