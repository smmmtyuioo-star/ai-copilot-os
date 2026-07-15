'use client'
import { useState, useEffect } from 'react'
import { Search, Brain, KeyRound, LogIn, AlertTriangle, Copy, Check, Eye, EyeOff, MessageSquare, Clock } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Input } from '@/components/ui'
import { formatDate, truncate } from '@/lib/utils'
import { localStore } from '@/lib/storage'
import { generateCredentials, verifyCredentials } from '@/lib/credentials'

interface MemoryDisplay {
  id: string
  conversationId: string
  role: string
  content: string
  createdAt: string
}

export default function MemoryPage() {
  const [activeCredential, setActiveCredential] = useState<{ id: string; password: string } | null>(null)
  const [showWarning, setShowWarning] = useState(false)
  const [loginId, setLoginId] = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [entries, setEntries] = useState<MemoryDisplay[]>([])
  const [query, setQuery] = useState('')
  const [copied, setCopied] = useState<'id' | 'password' | null>(null)
  const [showNewCreds, setShowNewCreds] = useState(false)
  const [newCreds, setNewCreds] = useState<{ id: string; password: string } | null>(null)

  useEffect(() => {
    const stored = localStorage.getItem('ac_active_credential')
    if (stored) {
      try {
        const cred = JSON.parse(stored)
        setActiveCredential(cred)
        if (!localStorage.getItem('ac_warning_dismissed')) {
          setShowWarning(true)
        }
      } catch {}
    }
  }, [])

  useEffect(() => {
    if (activeCredential) {
      loadMemories()
    }
  }, [activeCredential])

  function loadMemories() {
    if (!activeCredential) return
    const all = localStore.messages.items.filter(m => !m.credentialId || m.credentialId === activeCredential.id)
    const mapped: MemoryDisplay[] = all.map(m => ({
      id: m.id,
      conversationId: m.conversationId || '',
      role: m.role || 'user',
      content: m.content || '',
      createdAt: m.createdAt || new Date().toISOString(),
    }))
    setEntries(mapped.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()))
  }

  async function handleGenerate() {
    try {
      const { id, password } = await generateCredentials()
      setNewCreds({ id, password })
      setShowNewCreds(true)
      setLoginError('')
    } catch (e) {
      setLoginError('Failed to generate credentials')
    }
  }

  function handleAcceptNewCreds() {
    if (!newCreds) return
    localStorage.setItem('ac_active_credential', JSON.stringify(newCreds))
    localStorage.setItem('ac_warning_dismissed', 'true')
    setActiveCredential(newCreds)
    setShowNewCreds(false)
  }

  function handleLogin() {
    setLoginError('')
    if (!loginId.trim() || !loginPassword.trim()) {
      setLoginError('Enter both ID and password')
      return
    }
    const match = verifyCredentials(loginId.trim(), loginPassword.trim())
    if (!match) {
      setLoginError('Invalid ID or password')
      return
    }
    const cred = { id: match.id, password: match.password }
    localStorage.setItem('ac_active_credential', JSON.stringify(cred))
    setActiveCredential(cred)
    setLoginId('')
    setLoginPassword('')
  }

  function handleLogout() {
    localStorage.removeItem('ac_active_credential')
    setActiveCredential(null)
    setShowWarning(false)
    setEntries([])
  }

  async function copyToClipboard(text: string, type: 'id' | 'password') {
    await navigator.clipboard.writeText(text)
    setCopied(type)
    setTimeout(() => setCopied(null), 2000)
  }

  function handleDismissWarning() {
    setShowWarning(false)
  }

  const filteredEntries = query.trim()
    ? entries.filter(e => e.content.toLowerCase().includes(query.toLowerCase()))
    : entries

  if (!activeCredential) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Memory Vault</h1>
          <p className="text-sm text-gray-500">Your personal chat history — secured with auto-generated credentials</p>
        </div>

        <Card>
          <CardContent className="py-12">
            <div className="max-w-md mx-auto text-center space-y-6">
              <Brain className="h-12 w-12 mx-auto text-blue-500" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Access Your Memory</h2>
              <p className="text-sm text-gray-500">
                Generate a unique ID & password to store and retrieve your chat history permanently.
                All conversations are saved automatically.
              </p>
              <Button onClick={handleGenerate} className="w-full">
                <KeyRound className="h-4 w-4 mr-2" /> Generate My Memory ID
              </Button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-gray-300 dark:border-gray-600" /></div>
                <div className="relative flex justify-center text-xs"><span className="bg-white dark:bg-gray-900 px-2 text-gray-500">Or restore existing</span></div>
              </div>

              <div className="space-y-3 text-left">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Memory ID (6 digits)</label>
                  <Input value={loginId} onChange={e => setLoginId(e.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Password (10 digits)</label>
                  <Input type="password" value={loginPassword} onChange={e => setLoginPassword(e.target.value.replace(/\D/g, '').slice(0, 10))} placeholder="0000000000" />
                </div>
                {loginError && <p className="text-sm text-red-500">{loginError}</p>}
                <Button onClick={handleLogin} className="w-full" variant="secondary" disabled={!loginId.trim() || !loginPassword.trim()}>
                  <LogIn className="h-4 w-4 mr-2" /> Restore Memories
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Modal open={showNewCreds} onClose={() => setShowNewCreds(false)} title="Your Memory Credentials">
          <div className="space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm text-amber-800 dark:text-amber-200">
                  <strong>IMPORTANT: Save these credentials now.</strong>
                  <p className="mt-1">This is the ONLY time they will be shown. Do NOT share them with anyone. You need them to access your chat history.</p>
                </div>
              </div>
            </div>
            {newCreds && (
              <div className="space-y-3">
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <label className="block text-xs text-gray-500 mb-1">Your Memory ID (6 digits)</label>
                  <div className="flex items-center gap-2">
                    <code className="text-2xl font-mono font-bold text-gray-900 dark:text-gray-100 tracking-widest">{newCreds.id}</code>
                    <button onClick={() => copyToClipboard(newCreds.id, 'id')} className="text-gray-400 hover:text-gray-600">
                      {copied === 'id' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
                  <label className="block text-xs text-gray-500 mb-1">Your Password (10 digits)</label>
                  <div className="flex items-center gap-2">
                    <code className="text-2xl font-mono font-bold text-gray-900 dark:text-gray-100 tracking-widest">{newCreds.password}</code>
                    <button onClick={() => copyToClipboard(newCreds.password, 'password')} className="text-gray-400 hover:text-gray-600">
                      {copied === 'password' ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
            <Button onClick={handleAcceptNewCreds} className="w-full">I Saved My Credentials — Start Using Memory</Button>
          </div>
        </Modal>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <Modal open={showWarning} onClose={handleDismissWarning} title="Memory Credentials Saved">
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20 p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800 dark:text-amber-200">
                <strong>Never share these credentials.</strong>
                <p className="mt-1">Your Memory ID and password are the ONLY way to access your chat history. If you lose them, your data cannot be recovered.</p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <label className="block text-xs text-gray-500 mb-1">Memory ID</label>
              <code className="text-lg font-mono font-bold text-gray-900 dark:text-gray-100 tracking-widest">{activeCredential.id}</code>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <label className="block text-xs text-gray-500 mb-1">Password</label>
              <code className="text-lg font-mono font-bold text-gray-900 dark:text-gray-100 tracking-widest">{activeCredential.password}</code>
            </div>
          </div>
          <Button onClick={handleDismissWarning} className="w-full">I Understand — Continue</Button>
        </div>
      </Modal>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Memory Vault</h1>
          <p className="text-sm text-gray-500">All chat history stored permanently. ID: <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded">{activeCredential.id}</code></p>
        </div>
        <Button variant="secondary" onClick={handleLogout}><LogIn className="h-4 w-4 mr-1" /> Switch Account</Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search your memories..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-10 pr-4 text-sm dark:border-gray-600 dark:bg-gray-700"
          />
        </div>
      </div>

      {filteredEntries.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="mx-auto h-8 w-8 text-gray-400" />
            <p className="mt-2 text-gray-500">
              {query ? 'No memories match your search.' : 'No memories yet. Chat with AI to build your history.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          <p className="text-xs text-gray-400">{filteredEntries.length} memory entries</p>
          {filteredEntries.slice(0, 200).map(entry => (
            <Card key={entry.id}>
              <CardContent className="p-3">
                <div className="flex items-start gap-3">
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-medium ${entry.role === 'user' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'}`}>
                    {entry.role === 'user' ? 'You' : 'AI'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap break-words">{truncate(entry.content, 500)}</p>
                    <span className="text-xs text-gray-400 mt-1 inline-flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {formatDate(entry.createdAt)}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
          {filteredEntries.length > 200 && (
            <p className="text-center text-sm text-gray-400">Showing 200 of {filteredEntries.length} entries</p>
          )}
        </div>
      )}
    </div>
  )
}

function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
        </div>
        <div className="px-6 pb-6">{children}</div>
      </div>
    </div>
  )
}
