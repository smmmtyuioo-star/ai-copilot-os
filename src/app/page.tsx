'use client'
import { useState, useRef, useEffect } from 'react'
import { Search, Send, Bot, Menu, Plus, Trash2, Sun, Moon, MessageSquare, Brain, X, LayoutDashboard, Globe, Image as ImageIcon, Mic, FileText, Play, BookOpen, Plug, Puzzle, Network, Key, Settings, Monitor, ExternalLink, Loader2, AlertCircle, CheckCircle2, GitBranch, Paperclip, Code, Wand2, Upload, File, Video, RefreshCw, Edit3, LogOut } from 'lucide-react'
import { streamAiResponse } from '@/services/chat'
import { db } from '@/lib/db'
import type { Message, Conversation } from '@/types'
import { formatDate, generateId } from '@/lib/utils'

const URL_REGEX = /https?:\/\/[^\s]+/g
const BUILD_COMMAND = /^\/build\s+(.+)$/i
const GAME_TRIGGERS = [
  /^(?:build|make|create)\s+(?:a\s+)?(?:game|arcade|video\s*game)/i,
  /^(?:build|make|create)\s+(?:a\s+)?(?:snake|tetris|pong|platformer|shooter|puzzle|rpg|clicker|runner)/i,
  /(?:build|make|create)\s+(?:a\s+)?(?:game|video\s*game)\s+(?:called|named)?\s*["']?([^"']+)/i,
]
const WEBSITE_TRIGGERS = [
  /^(?:build|make|create|generate)\s+(?:a\s+)?(?:website|site|web\s*page|landing\s*page|landing)/i,
  /^(?:build|make|create|generate)\s+(?:a\s+)?(?:portfolio|blog|business\s*site|ecommerce|store)/i,
  /^(?:build|make|create)\s+(?:a\s+)?(?:site|website)\s+(?:for|called|named)?\s*["']?([^"']+)/i,
]

const CONNECTOR_COMMANDS: Record<string, { pattern: RegExp; action: string; extract: (match: RegExpMatchArray) => any }> = {
  github: {
    pattern: /(?:list|show|my)\s+(?:repos|repositories)/i,
    action: 'list-repos',
    extract: () => ({}),
  },
  'create-repo': {
    pattern: /(?:create|make|new)\s+(?:a\s+)?(?:repo|repository)\s+(?:called\s+|named\s+)?["']?([a-zA-Z0-9_-]+)["']?/i,
    action: 'create-repo',
    extract: (m: RegExpMatchArray) => ({ name: m[1] }),
  },
  'repo-info': {
    pattern: /(?:info|details|about)\s+(?:repo|repository)\s+["']?([a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+)["']?/i,
    action: 'get-repo',
    extract: (m: RegExpMatchArray) => ({ repo: m[1] }),
  },
  'github-user': {
    pattern: /(?:who\s+)?(?:am\s+i|my\s+(?:github\s+)?(?:info|profile|account|details))/i,
    action: 'user-info',
    extract: () => ({}),
  },
}


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
  const [showAttach, setShowAttach] = useState(false)
  const [selectedModel, setSelectedModel] = useState('llama-3.3-70b-versatile')
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [searchConv, setSearchConv] = useState('')
  const [editingConv, setEditingConv] = useState<string | null>(null)
  const [renameInput, setRenameInput] = useState('')
  const attachRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      setDark(isDark)
      document.documentElement.classList.toggle('dark', isDark)
    }
    loadConversations()
  }, [])

  useEffect(() => {
    if (showAttach) {
      const handler = (e: MouseEvent) => {
        if (attachRef.current && !attachRef.current.contains(e.target as Node)) setShowAttach(false)
      }
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [showAttach])

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

  async function submitRename(id: string) {
    if (!renameInput.trim()) { setEditingConv(null); return }
    const store = JSON.parse(localStorage.getItem('ac_conversations') || '[]') as any[]
    const idx = store.findIndex((c: any) => c.id === id)
    if (idx >= 0) { store[idx].title = renameInput; localStorage.setItem('ac_conversations', JSON.stringify(store)) }
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: renameInput } : c))
    setEditingConv(null)
  }

  async function handleSignOut() {
    localStorage.removeItem('ac_user')
    window.location.href = '/auth/login'
  }

  async function handleDelete(id: string) {
    await db.deleteConversation(id)
    setConversations(prev => prev.filter(c => c.id !== id))
    if (activeConv === id) { setActiveConv(null); setMessages([]) }
  }

  async function executeAutoAgent(userMessage: string): Promise<string | null> {
    try {
      const agents = JSON.parse(localStorage.getItem('ac_agents') || '[]') as any[]
      const activeAgents = agents.filter((a: any) => a.status !== 'error')
      if (activeAgents.length === 0) return null

      const lower = userMessage.toLowerCase()
      const matched = activeAgents.find((a: any) => {
        const role = (a.role || a.name || '').toLowerCase()
        if (lower.includes('code') || lower.includes('build') || lower.includes('implement')) return role.includes('code-generator') || role.includes('api-builder')
        if (lower.includes('test') || lower.includes('unit') || lower.includes('coverage')) return role.includes('test-generator')
        if (lower.includes('security') || lower.includes('vulnerability') || lower.includes('audit')) return role.includes('security-reviewer')
        if (lower.includes('research') || lower.includes('search') || lower.includes('find')) return role.includes('research')
        if (lower.includes('architect') || lower.includes('design') || lower.includes('plan')) return role.includes('architecture-designer') || role.includes('requirement-planner')
        return false
      })

      if (!matched) return null

      const response = await fetch('/api/ai/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent: {
            name: matched.name,
            role: matched.role,
            model: matched.model || 'llama-3.3-70b-versatile',
            system_prompt: matched.systemPrompt || matched.system_prompt || (matched.role ? `${matched.role} agent` : 'Helpful agent'),
            tools: matched.tools || [],
          },
          request: userMessage,
        }),
      })
      if (!response.ok) {
        const err = await response.json().catch(() => ({}))
        return `Agent triggered but API error: ${err.error || 'Unknown error'}`
      }
      const result = await response.json()
      return `**${matched.name || matched.role}** auto-triggered:\n\n${result.output || 'Agent completed its task.'}`
    } catch {
      return null
    }
  }

  async function executeConnector(userMessage: string): Promise<string | null> {
    try {
      const connectors = JSON.parse(localStorage.getItem('ac_connectors') || '[]') as any[]
      for (const cmd of Object.values(CONNECTOR_COMMANDS)) {
        const match = userMessage.match(cmd.pattern)
        if (match) {
          const connector = connectors.find((c: any) => c.provider === 'github' && c.status === 'connected')
          if (!connector) return 'To use GitHub commands, add and connect your GitHub connector first:\n1. Go to Connectors page\n2. Add GitHub with your personal access token\n3. Test the connection'

          const params = cmd.extract(match)
          const res = await fetch('/api/connectors/execute', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ provider: 'github', action: cmd.action, params, credentials: connector.config }),
          })
          const result = await res.json()
          if (!result.success) return `GitHub error: ${result.error}`
          return formatConnectorResult(cmd.action, result.data)
        }
      }
    } catch { /* not a connector command */ }
    return null
  }

async function handleBuildCommand(userMessage: string): Promise<string | null> {
    const match = userMessage.match(BUILD_COMMAND)
    if (!match) return null
    const prompt = match[1].trim()
    if (!prompt) return 'Usage: `/build your project description here`'

    // Navigate to build page with the prompt
    localStorage.setItem('ac_build_prompt', prompt)
    window.location.href = '/build'
    return `🚀 Starting build pipeline for: **${prompt}**\n\nRedirecting to Build Pipeline with live preview...`
  }

  async function executeGameBuilder(userMessage: string): Promise<string | null> {
    const matched = GAME_TRIGGERS.some(r => r.test(userMessage.trim()))
    if (!matched) return null
    const desc = userMessage.trim().length > 150 ? userMessage.trim().slice(0, 150) : userMessage.trim()
    try {
      const res = await fetch('/api/build/game', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc }),
      })
      const data = await res.json()
      if (!data.success) return `**🎮 Game Builder**\n\nFailed: ${data.error || 'Unknown error'}`
      return `**🎮 Game Built: ${data.title}**\n\n${data.summary}\n\n\`\`\`html\n${data.code}\n\`\`\`\n\n---\n_Send this to someone or save it as an HTML file to play!_`
    } catch {
      return '**🎮 Game Builder**\n\nFailed to reach build service.'
    }
  }

  async function executeWebsiteBuilder(userMessage: string): Promise<string | null> {
    const matched = WEBSITE_TRIGGERS.some(r => r.test(userMessage.trim()))
    if (!matched) return null
    const desc = userMessage.trim().length > 150 ? userMessage.trim().slice(0, 150) : userMessage.trim()
    try {
      const res = await fetch('/api/build/website', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc }),
      })
      const data = await res.json()
      if (!data.success) return `**🌐 Website Builder**\n\nFailed: ${data.error || 'Unknown error'}`
      return `**🌐 Website Built: ${data.title}**\n\n${data.summary}\n\n\`\`\`html\n${data.code}\n\`\`\`\n\n---\n_Open this HTML file in any browser to see your site!_`
    } catch {
      return '**🌐 Website Builder**\n\nFailed to reach build service.'
    }
  }

  function formatConnectorResult(action: string, data: any): string {
    switch (action) {
      case 'list-repos':
        return `**Your Repositories (${data.length})**\n\n${data.slice(0, 20).map((r: any) => `• **${r.name}** ${r.private ? '🔒' : '🌍'} ${r.language || ''}\n  ${r.description || ''}\n  ${r.url}`).join('\n\n')}`
      case 'create-repo':
        return `✅ **Repository created!**\n\n**${data.full_name}**\n${data.url}\n\`git clone ${data.clone_url}\``
      case 'get-repo':
        return `**${data.full_name}**\n${data.description || ''}\n\n⭐ Stars: ${data.stars} | 🍴 Forks: ${data.forks} | ⚠️ Issues: ${data.open_issues}\n🔤 Language: ${data.language}\n${data.url}`
      case 'create-file':
        return `✅ **File committed!**\n\nCommit: \`${data.commit.slice(0, 7)}\`\nMessage: ${data.message}\n${data.url}`
      case 'user-info':
        return `**GitHub Profile**\n\n👤 **${data.name || data.login}** (@${data.login})\n📧 ${data.email || 'No public email'}\n📦 Public repos: ${data.public_repos}\n👥 Followers: ${data.followers}`
      default:
        return JSON.stringify(data, null, 2)
    }
  }

  async function handleRegenerate(msgId: string) {
    const idx = messages.findIndex(m => m.id === msgId)
    if (idx < 1) return
    const prevMsgs = messages.slice(0, idx)
    const convId = activeConv
    if (!convId) return

    setStreaming(true)
    setStreamContent('')
    const abortController = new AbortController()
    abortRef.current = abortController
    const history = prevMsgs.map(m => ({ role: m.role, content: m.content }))

    const fullResponse = await streamAiResponse(
      history, selectedModel,
      (token) => setStreamContent(prev => prev + token),
      (error) => { setStreamContent(`Error: ${error}`); setStreaming(false) },
      abortController.signal,
    )
    if (abortRef.current === abortController) abortRef.current = null
    if (fullResponse) {
      const newMsg: Message = {
        id: generateId(), conversation_id: convId, role: 'assistant',
        content: fullResponse, created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev.slice(0, idx), newMsg])
      await db.addMessage(newMsg)
    }
    setStreaming(false)
    setStreamContent('')
  }

  function startEdit(msgId: string, content: string) {
    setEditingMsgId(msgId)
    setEditText(content)
  }

  async function submitEdit() {
    if (!editingMsgId || !editText.trim()) return
    const idx = messages.findIndex(m => m.id === editingMsgId)
    if (idx < 0) { setEditingMsgId(null); return }

    const convId = activeConv
    if (!convId) { setEditingMsgId(null); return }

    const editedMsg: Message = {
      id: generateId(), conversation_id: convId, role: 'user',
      content: editText, created_at: new Date().toISOString(),
    }
    const kept = messages.slice(0, idx)
    setEditingMsgId(null)
    setStreaming(true)
    setStreamContent('')

    const abortController = new AbortController()
    abortRef.current = abortController
    const history = [...kept, editedMsg].map(m => ({ role: m.role, content: m.content }))

    const fullResponse = await streamAiResponse(
      history, selectedModel,
      (token) => setStreamContent(prev => prev + token),
      (error) => { setStreamContent(`Error: ${error}`); setStreaming(false) },
      abortController.signal,
    )
    if (abortRef.current === abortController) abortRef.current = null

    const finalMsgs = [...kept, editedMsg]
    if (fullResponse) {
      const asstMsg: Message = {
        id: generateId(), conversation_id: convId, role: 'assistant',
        content: fullResponse, created_at: new Date().toISOString(),
      }
      finalMsgs.push(asstMsg)
      await db.addMessage(asstMsg)
    }
    setMessages(finalMsgs)
    await db.addMessage(editedMsg)
    setStreaming(false)
    setStreamContent('')
  }

  function cancelEdit() {
    setEditingMsgId(null)
    setEditText('')
  }

  function handleCancel() {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
    setStreaming(false)
    setStreamContent(prev => prev + '\n\n[Generation cancelled]')
  }

  async function handleSend() {
    if (!input.trim() || streaming) return
    let convId = activeConv
    if (!convId) {
      const conv: Conversation = {
        id: generateId(), user_id: 'local', title: input.slice(0, 50),
        model: selectedModel,
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
    const sentInput = input
    setInput('')
    setStreaming(true)
    setStreamContent('')

    // Check for build command first
    const buildResult = await handleBuildCommand(sentInput)
    if (buildResult) {
      setStreamContent(buildResult)
      const asstMsg: Message = {
        id: generateId(), conversation_id: convId, role: 'assistant',
        content: buildResult, created_at: new Date().toISOString(),
      }
      await db.addMessage(asstMsg)
      setMessages(prev => [...prev, asstMsg])
      setStreaming(false)
      setStreamContent('')
      return
    }

    // Check for game builder trigger
    const gameResult = await executeGameBuilder(sentInput)
    if (gameResult) {
      setStreamContent(gameResult)
      const asstMsg: Message = {
        id: generateId(), conversation_id: convId, role: 'assistant',
        content: gameResult, created_at: new Date().toISOString(),
      }
      await db.addMessage(asstMsg)
      setMessages(prev => [...prev, asstMsg])
      setStreaming(false)
      setStreamContent('')
      return
    }

    // Check for website builder trigger
    const websiteResult = await executeWebsiteBuilder(sentInput)
    if (websiteResult) {
      setStreamContent(websiteResult)
      const asstMsg: Message = {
        id: generateId(), conversation_id: convId, role: 'assistant',
        content: websiteResult, created_at: new Date().toISOString(),
      }
      await db.addMessage(asstMsg)
      setMessages(prev => [...prev, asstMsg])
      setStreaming(false)
      setStreamContent('')
      return
    }

    // Check for auto-trigger agents
    const agentResult = await executeAutoAgent(sentInput)
    if (agentResult) {
      setStreamContent(agentResult)
      const asstMsg: Message = {
        id: generateId(), conversation_id: convId, role: 'assistant',
        content: agentResult, created_at: new Date().toISOString(),
      }
      await db.addMessage(asstMsg)
      setMessages(prev => [...prev, asstMsg])
      setStreaming(false)
      setStreamContent('')
      return
    }

    // Check for connector commands first
    const connectorResult = await executeConnector(sentInput)
    if (connectorResult) {
      setStreamContent(connectorResult)
      const asstMsg: Message = {
        id: generateId(), conversation_id: convId, role: 'assistant',
        content: connectorResult, created_at: new Date().toISOString(),
      }
      await db.addMessage(asstMsg)
      setMessages(prev => [...prev, asstMsg])
      setStreaming(false)
      setStreamContent('')
      return
    }

    const abortController = new AbortController()
    abortRef.current = abortController
    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))

    const fullResponse = await streamAiResponse(
      history, selectedModel,
      (token) => setStreamContent(prev => prev + token),
      (error) => { setStreamContent(`Error: ${error}`); setStreaming(false) },
      abortController.signal,
    )
    if (fullResponse) {
      const asstMsg: Message = {
        id: generateId(), conversation_id: convId, role: 'assistant',
        content: fullResponse, created_at: new Date().toISOString(),
      }
      await db.addMessage(asstMsg)
      setMessages(prev => [...prev, asstMsg])
    }
    if (abortRef.current === abortController) abortRef.current = null
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

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    Array.from(files).forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        const content = reader.result as string
        if (file.type.startsWith('image/')) {
          setInput(prev => prev + `\n[Attached image: ${file.name} — text preview not available, requires vision model]\n`)
        } else if (file.type.startsWith('video/')) {
          setInput(prev => prev + `\n[Attached video: ${file.name} — transcript requires video processing API]\n`)
        } else {
          setInput(prev => prev + `\n[Attached: ${file.name}]\n${content.slice(0, 50000)}\n`)
        }
      }
      if (file.type.startsWith('text/') || file.type.includes('json') || file.type.includes('javascript') || file.name.endsWith('.md') || file.name.endsWith('.csv')) {
        reader.readAsText(file)
      } else if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        // readAsDataURL needed to trigger onload, but content discarded — see limitation below
        reader.readAsDataURL(file)
      } else {
        reader.readAsText(file)
      }
    })
    setShowAttach(false)
    e.target.value = ''
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
              {conversations.length > 0 && (
                <>
                  <p className="px-3 py-1 mt-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Conversations</p>
                  <div className="relative px-3 mb-1">
                    <Search className="absolute left-5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
                    <input value={searchConv} onChange={e => setSearchConv(e.target.value)}
                      placeholder="Search chats..." className="w-full rounded-md border border-gray-200 py-1 pl-6 pr-2 text-xs dark:border-gray-700 dark:bg-gray-800" />
                  </div>
                  {conversations.filter(c => !searchConv || c.title.toLowerCase().includes(searchConv.toLowerCase())).map(c => (
                    <div key={c.id} className="group flex items-center gap-1 px-3 py-1.5">
                      {editingConv === c.id ? (
                        <input value={renameInput} onChange={e => setRenameInput(e.target.value)}
                          onBlur={() => submitRename(c.id)} onKeyDown={e => { if (e.key === 'Enter') submitRename(c.id); if (e.key === 'Escape') setEditingConv(null) }}
                          className="flex-1 rounded border border-blue-400 px-1.5 py-0.5 text-xs dark:bg-gray-700" autoFocus
                          onClick={e => e.stopPropagation()} />
                      ) : (
                        <button onClick={() => { selectConversation(c.id); setSidebar(false) }}
                          className={`flex-1 truncate text-left text-xs py-0.5 rounded px-1.5 ${activeConv === c.id ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200' : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'}`}>
                          {c.title}
                        </button>
                      )}
                      {editingConv !== c.id && (
                        <div className="hidden group-hover:flex items-center gap-0.5">
                          <button onClick={() => { setEditingConv(c.id); setRenameInput(c.title) }}
                            className="text-gray-400 hover:text-blue-500"><Edit3 className="h-3 w-3" /></button>
                          <button onClick={() => handleDelete(c.id)}
                            className="text-gray-400 hover:text-red-500"><Trash2 className="h-3 w-3" /></button>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </div>
            <div className="border-t border-gray-200 p-3 space-y-2 dark:border-gray-800">
              <button onClick={handleSignOut} className="flex items-center gap-2 text-xs text-gray-400 hover:text-red-500 w-full">
                <LogOut className="h-3.5 w-3.5" /> Sign Out
              </button>
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
            <select value={selectedModel} onChange={e => setSelectedModel(e.target.value)}
              className="text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5">
              <optgroup label="Groq (Free)">
                <option value="llama-3.3-70b-versatile">Llama 3.3 70B</option>
                <option value="llama-3.1-8b-instant">Llama 3.1 8B</option>
                <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                <option value="gemma2-9b-it">Gemma 2 9B</option>
              </optgroup>
              <optgroup label="OpenRouter">
                <option value="openai/gpt-4o">GPT-4o</option>
                <option value="anthropic/claude-3.5-sonnet">Claude 3.5 Sonnet</option>
              </optgroup>
            </select>
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
                <div>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}>
                    {editingMsgId === msg.id ? (
                      <div className="space-y-2">
                        <textarea value={editText} onChange={e => setEditText(e.target.value)}
                          className="w-full rounded-lg border border-gray-300 p-2 text-sm text-gray-900 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                          rows={3} />
                        <div className="flex gap-2">
                          <button onClick={submitEdit} className="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700">Save</button>
                          <button onClick={cancelEdit} className="text-xs px-2 py-1 rounded bg-gray-300 text-gray-700 hover:bg-gray-400">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                    )}
                    <p className="mt-1 text-xs opacity-50">{formatDate(msg.created_at)}</p>
                  </div>
                  <div className={`flex gap-1 mt-1 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                    {msg.role === 'user' && editingMsgId !== msg.id && (
                      <button onClick={() => startEdit(msg.id, msg.content)}
                        className="text-xs text-gray-400 hover:text-blue-500 flex items-center gap-0.5">
                        <Edit3 className="h-3 w-3" /> Edit
                      </button>
                    )}
                    {msg.role !== 'user' && !streaming && (
                      <button onClick={() => handleRegenerate(msg.id)}
                        className="text-xs text-gray-400 hover:text-blue-500 flex items-center gap-0.5">
                        <RefreshCw className="h-3 w-3" /> Regenerate
                      </button>
                    )}
                  </div>
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
            <div ref={attachRef} className="relative">
              <button onClick={() => setShowAttach(!showAttach)} disabled={streaming}
                className="rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 p-3 text-gray-500 hover:text-gray-700 hover:border-gray-400 disabled:opacity-50">
                <Plus className="h-4 w-4" />
              </button>
              {showAttach && (
                <div className="absolute bottom-full left-0 mb-2 w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
                  <label className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer text-sm">
                    <Upload className="h-4 w-4 text-blue-500" /> Upload File / Image
                    <input type="file" multiple onChange={handleFileUpload} className="hidden" />
                  </label>
                  <button onClick={() => { window.location.href = '/plugins'; setShowAttach(false) }} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm text-left">
                    <Puzzle className="h-4 w-4 text-purple-500" /> Plugins
                    <span className="ml-auto text-xs text-gray-400">{(() => { try { return JSON.parse(localStorage.getItem('ac_plugins') || '[]').length } catch { return 0 } })()} installed</span>
                  </button>
                  <button onClick={() => { window.location.href = '/skills'; setShowAttach(false) }} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm text-left">
                    <Wand2 className="h-4 w-4 text-green-500" /> Skills
                  </button>
                  <button onClick={() => { window.location.href = '/agents'; setShowAttach(false) }} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm text-left">
                    <Bot className="h-4 w-4 text-amber-500" /> Agents
                  </button>
                </div>
              )}
            </div>
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
            {streaming ? (
              <button onClick={handleCancel}
                className="rounded-xl bg-red-600 p-3 text-white hover:bg-red-700 flex items-center gap-1.5">
                <span className="block w-3 h-3 bg-white rounded-sm" />
                <span className="text-xs font-medium">Stop</span>
              </button>
            ) : (
              <button onClick={handleSend} disabled={!input.trim() || streaming}
                className="rounded-xl bg-blue-600 p-3 text-white hover:bg-blue-700 disabled:opacity-50">
                <Send className="h-4 w-4" />
              </button>
            )}
          </div>
          <p className="text-center text-xs text-gray-400 mt-2">AI Copilot OS • Built by Rishav • Real AI. Real Build. Real Preview.</p>
        </div>
      </div>
    </div>
  )
}
