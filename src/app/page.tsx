'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Bot, Menu, Plus, Trash2, Sun, Moon, MessageSquare, Brain, X, LayoutDashboard, Globe, Image as ImageIcon, Mic, FileText, Workflow, Play, BookOpen, Plug, Puzzle, Network, Key, Settings, Monitor, ExternalLink, Loader2, AlertCircle } from 'lucide-react'
import { streamAiResponse } from '@/services/chat'
import { db } from '@/lib/db'
import type { Message, Conversation } from '@/types'
import { formatDate, generateId } from '@/lib/utils'

const URL_REGEX = /https?:\/\/[^\s]+/g

const THINKING_STAGES = ['Analyzing', 'Thinking', 'Building', 'Processing', 'Researching', 'Crafting']

export default function HomePage() {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [thinkStage, setThinkStage] = useState(0)
  const [streamContent, setStreamContent] = useState('')
  const [sidebar, setSidebar] = useState(false)
  const [dark, setDark] = useState(false)
  const [urlPreview, setUrlPreview] = useState<{ url: string; title: string; loading: boolean; error: string } | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setDark(isDark)
      document.documentElement.classList.toggle('dark', isDark)
    }
    loadConversations()
  }, [])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, streamContent])

  useEffect(() => {
    if (!streaming) { setThinkStage(0); return }
    const interval = setInterval(() => setThinkStage(prev => (prev + 1) % THINKING_STAGES.length), 1800)
    return () => clearInterval(interval)
  }, [streaming])

  async function loadConversations() {
    const convs = await db.getConversations()
    setConversations(convs)
  }

  async function newConversation() {
    const conv: Conversation = {
      id: generateId(), user_id: 'local', title: 'New Chat',
      model: 'llama-3.3-70b-versatile',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    await db.addConversation(conv)
    setConversations(prev => [conv, ...prev])
    setActiveConv(conv.id)
    setMessages([])
  }

  async function selectConversation(id: string) {
    setActiveConv(id)
    const msgs = await db.getMessages(id)
    setMessages(msgs)
    setSidebar(false)
  }

  async function handleDelete(id: string) {
    await db.deleteConversation(id)
    setConversations(prev => prev.filter(c => c.id !== id))
    if (activeConv === id) { setActiveConv(null); setMessages([]) }
  }

  async function handleSend() {
    if (!input.trim() || streaming) return
    let convId = activeConv
    if (!convId) {
      const conv: Conversation = {
        id: generateId(), user_id: 'local', title: input.slice(0, 50),
        model: 'llama-3.3-70b-versatile',
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }
      await db.addConversation(conv)
      convId = conv.id; setActiveConv(conv.id)
      setConversations(prev => [conv, ...prev])
    }

    const userMsg: Message = {
      id: generateId(), conversation_id: convId, role: 'user',
      content: input, created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    await db.addMessage(userMsg)
    setInput(''); setStreaming(true); setStreamContent('')

    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))
    const fullResponse = await streamAiResponse(history, 'llama-3.3-70b-versatile',
      (token) => setStreamContent(prev => prev + token),
      (error) => { setStreamContent(`Error: ${error}`); setStreaming(false) },
    )
    if (fullResponse) {
      const asstMsg: Message = {
        id: generateId(), conversation_id: convId, role: 'assistant',
        content: fullResponse, created_at: new Date().toISOString(),
      }
      await db.addMessage(asstMsg)
      setMessages(prev => [...prev, asstMsg])
    }
    setStreaming(false); setStreamContent('')
  }

  async function handleInputChange(value: string) {
    setInput(value)
    const urls = value.match(URL_REGEX)
    if (urls) {
      const url = urls[0]
      setUrlPreview({ url, title: 'Fetching...', loading: true, error: '' })
      try {
        const res = await fetch('/api/browser/fetch', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
        })
        if (res.ok) {
          const data = await res.json()
          setUrlPreview({ url, title: data.content?.slice(0, 150) || 'URL detected', loading: false, error: '' })
        } else {
          setUrlPreview({ url, title: '', loading: false, error: 'Could not fetch URL' })
        }
      } catch {
        setUrlPreview({ url, title: '', loading: false, error: 'Fetch failed' })
      }
    } else {
      setUrlPreview(null)
    }
  }

  async function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function toggleDark() {
    setDark(!dark)
    document.documentElement.classList.toggle('dark')
  }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Sidebar */}
      {sidebar && (
        <div className="fixed inset-0 z-40 flex">
          <div className="w-72 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Brain className="h-5 w-5 text-blue-600" /> AI Copilot OS
              </div>
              <button onClick={() => setSidebar(false)}><X className="h-4 w-4" /></button>
            </div>
            <div className="p-3 border-b border-gray-200 dark:border-gray-800">
              <button onClick={() => { newConversation(); setSidebar(false) }}
                className="flex w-full items-center gap-2 rounded-lg border border-gray-300 dark:border-gray-700 px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800">
                <Plus className="h-4 w-4" /> New Chat
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-0.5">
              <p className="px-3 py-1 text-xs font-semibold text-gray-400 uppercase tracking-wider">Workspace</p>
              {[
                { href: '/', label: 'Chat', icon: MessageSquare },
                { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
                { href: '/build', label: 'Build Pipeline', icon: Play },
                { href: '/preview', label: 'Live Preview', icon: Monitor },
                { href: '/workflows', label: 'Workflows', icon: Workflow },
                { href: '/agents', label: 'Agents', icon: Bot },
              ].map(item => {
                const Icon = item.icon
                return (
                  <a key={item.href} href={item.href} onClick={() => setSidebar(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800">
                    <Icon className="h-4 w-4" /> {item.label}
                  </a>
                )
              })}
              <p className="px-3 py-1 mt-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Intelligence</p>
              {[
                { href: '/documents', label: 'Documents', icon: FileText },
                { href: '/web', label: 'Web Intelligence', icon: Globe },
                { href: '/image-studio', label: 'Image Studio', icon: ImageIcon },
                { href: '/voice', label: 'Voice', icon: Mic },
                { href: '/knowledge', label: 'Knowledge Base', icon: BookOpen },
              ].map(item => {
                const Icon = item.icon
                return (
                  <a key={item.href} href={item.href} onClick={() => setSidebar(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800">
                    <Icon className="h-4 w-4" /> {item.label}
                  </a>
                )
              })}
              <p className="px-3 py-1 mt-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Connections</p>
              {[
                { href: '/connectors', label: 'Connectors', icon: Plug },
                { href: '/plugins', label: 'Plugins', icon: Puzzle },
                { href: '/mcp', label: 'MCP', icon: Network },
                { href: '/api-center', label: 'API Center', icon: Key },
                { href: '/browser', label: 'Browser', icon: Globe },
              ].map(item => {
                const Icon = item.icon
                return (
                  <a key={item.href} href={item.href} onClick={() => setSidebar(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800">
                    <Icon className="h-4 w-4" /> {item.label}
                  </a>
                )
              })}
              <p className="px-3 py-1 mt-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">System</p>
              {[
                { href: '/memory', label: 'Memory', icon: Brain },
                { href: '/settings', label: 'Settings', icon: Settings },
              ].map(item => {
                const Icon = item.icon
                return (
                  <a key={item.href} href={item.href} onClick={() => setSidebar(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-gray-700 hover:bg-gray-200 dark:text-gray-300 dark:hover:bg-gray-800">
                    <Icon className="h-4 w-4" /> {item.label}
                  </a>
                )
              })}
            </div>
            <div className="border-t border-gray-200 p-3 text-xs text-gray-400 dark:border-gray-800">
              {conversations.length > 0 && <p className="truncate">{conversations.length} conversations</p>}
            </div>
          </div>
          <div className="flex-1 bg-black/20" onClick={() => setSidebar(false)} />
        </div>
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 h-12 border-b border-gray-200 dark:border-gray-800">
          <button onClick={() => setSidebar(true)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={toggleDark} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
            {messages.length === 0 && !streaming && (
              <div className="flex flex-col items-center justify-center pt-20 text-center">
                <Bot className="h-16 w-16 text-blue-600 mb-4" />
                <h1 className="text-2xl font-bold">What can I help you build?</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Chat • Code • Research • Automate</p>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                {msg.role !== 'user' && <Bot className="h-6 w-6 shrink-0 mt-1 text-blue-600" />}
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                  <p className="mt-1 text-xs opacity-50">{formatDate(msg.created_at)}</p>
                </div>
              </div>
            ))}
            {streaming && (
              <div className="flex gap-4">
                <div className="relative shrink-0 mt-1">
                  <Bot className="h-6 w-6 text-blue-600" />
                  <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
                  </span>
                </div>
                <div className="max-w-[80%] rounded-2xl px-4 py-3 bg-gray-100 dark:bg-gray-800">
                  {streamContent ? (
                    <>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{streamContent}</p>
                      <span className="inline-block w-2 h-4 bg-blue-600 animate-pulse ml-0.5" />
                    </>
                  ) : (
                    <div className="flex items-center gap-3 py-1">
                      <div className="flex gap-1">
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-sm text-blue-600 font-medium animate-pulse">{THINKING_STAGES[thinkStage]}...</span>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 dark:border-gray-800 p-4">
          <div className="mx-auto max-w-3xl flex gap-2">
            <div className="flex-1 relative">
              <input
                value={input} onChange={e => handleInputChange(e.target.value)} onKeyDown={handleKeyDown}
                placeholder="Ask anything — build, research, automate..."
                disabled={streaming}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {urlPreview && (
                <div className="absolute bottom-full left-0 right-0 mb-2 rounded-lg border border-blue-200 bg-blue-50 p-2 text-xs dark:border-blue-800 dark:bg-blue-900/30">
                  {urlPreview.loading ? (
                    <div className="flex items-center gap-2 text-blue-600"><Loader2 className="h-3 w-3 animate-spin" /> Fetching URL info...</div>
                  ) : urlPreview.error ? (
                    <div className="flex items-center gap-2 text-yellow-600"><AlertCircle className="h-3 w-3" /> {urlPreview.error}</div>
                  ) : (
                    <div className="flex items-start gap-2">
                      <ExternalLink className="h-3 w-3 mt-0.5 shrink-0 text-blue-600" />
                      <span className="text-gray-700 dark:text-gray-300 line-clamp-2">{urlPreview.title}</span>
                    </div>
                  )}
                  <button onClick={() => { setInput(urlPreview.url); setUrlPreview(null) }} className="mt-1 text-blue-600 hover:underline">Add to message</button>
                </div>
              )}
            </div>
            <button onClick={handleSend} disabled={!input.trim() || streaming}
              className="rounded-xl bg-blue-600 p-3 text-white hover:bg-blue-700 disabled:opacity-50">
              {streaming ? <span className="block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-center text-xs text-gray-400 mt-2">AI Copilot OS • Built by Rishav • Real AI. Real Build. Real Preview.</p>
        </div>
      </div>
    </div>
  )
}
