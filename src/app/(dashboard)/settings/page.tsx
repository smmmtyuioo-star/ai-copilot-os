'use client'
import { useState } from 'react'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui'
import { Input } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { updateProfile } from '@/services/auth'

const MODELS = [
  { provider: 'openai', label: 'OpenAI', models: [
    { id: 'gpt-4o', name: 'GPT-4o' },
    { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
  ]},
  { provider: 'groq', label: 'Groq (Free)', models: [
    { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B' },
    { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B' },
    { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B' },
    { id: 'gemma2-9b-it', name: 'Gemma 2 9B' },
  ]},
]

export default function SettingsPage() {
  const { user } = useAuth()
  const [name, setName] = useState(user?.name || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  async function handleSave() {
    setSaving(true)
    setSaved(false)
    const result = await updateProfile({ name })
    setSaving(false)
    if (result.success) setSaved(true)
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
                  <span key={m.id} className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs dark:border-gray-600">
                    {m.name}
                  </span>
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
        <CardContent>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Use the theme toggle in the header to switch between light, dark, and system mode.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
