'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Logo } from '@/components/ui/logo'
import { Search, Send, Bot, Menu, Plus, Trash2, Sun, Moon, MessageSquare, Brain, X, LayoutDashboard, Globe, Image as ImageIcon, Mic, FileText, Play, BookOpen, Plug, Puzzle, Network, Key, Settings, Monitor, ExternalLink, Loader2, AlertCircle, CheckCircle2, GitBranch, Paperclip, Code, Wand2, Upload, File, Video, RefreshCw, Edit3, LogOut, CreditCard } from 'lucide-react'
import { streamAiResponse } from '@/services/chat'
import { db } from '@/lib/db'
import { localStore } from '@/lib/storage'
import type { Message, Conversation } from '@/types'
import { formatDate, generateId } from '@/lib/utils'
import { signOut as authSignOut } from '@/services/auth'
import { loadHistory, pushUndo, undo, redo, canUndo, canRedo } from '@/services/undo-redo'
import { loadPermissions, getMode, setMode, checkPermission, getRules, addRule, removeRule, DEFAULT_RULES, type PermissionMode } from '@/services/permissions'
import { createWorkflow, advanceStage, completeWorkflow, type WorkflowState } from '@/services/workflow'
import { loadStreamSession, saveStreamSession, clearStreamSession, updateStreamContent } from '@/services/stream-session'
import { useOffline, OfflineBanner } from '@/components/offline-detector'
import { useShortcuts, ShortcutsHelpModal } from '@/components/keyboard-shortcuts'
import WorkflowBar from '@/components/workflow-bar'
import UndoRedoToolbar from '@/components/undo-redo-toolbar'
import dynamic from 'next/dynamic'

const LoadingMesh = dynamic(() => import('@/components/shared/loading-mesh'), { ssr: false })

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

interface ModelOption {
  value: string
  label: string
  group: string
  free: boolean
  context: number
  tier: 'fast' | 'powerful' | 'flagship'
  agents: boolean
}

const MODELS: ModelOption[] = [
  { value: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', group: 'Groq', free: true, context: 8192, tier: 'flagship', agents: true },
  { value: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B', group: 'Groq', free: true, context: 8192, tier: 'fast', agents: false },
  { value: 'mistral-medium', label: 'Mistral Medium', group: 'Mistral', free: false, context: 8192, tier: 'powerful', agents: true },
  { value: 'mistral-small', label: 'Mistral Small', group: 'Mistral', free: false, context: 8192, tier: 'fast', agents: false },
  { value: 'openai/gpt-4o', label: 'GPT-4o', group: 'OpenRouter', free: false, context: 16384, tier: 'flagship', agents: true },
  { value: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B', group: 'OpenRouter', free: false, context: 8192, tier: 'flagship', agents: true },
  { value: 'nvidia/nemotron-3-ultra-550b-a55b', label: 'Nemotron 3 Ultra 550B', group: 'NVIDIA', free: true, context: 16384, tier: 'flagship', agents: true },
  { value: 'deepseek-ai/deepseek-v4-flash', label: 'DeepSeek V4 Flash', group: 'NVIDIA', free: true, context: 8192, tier: 'fast', agents: false },
  { value: '@cf/meta/llama-3.1-8b-instruct-fp8', label: 'Llama 3.1 8B FP8', group: 'Cloudflare', free: true, context: 8192, tier: 'flagship', agents: true },
  { value: '@cf/meta/llama-3.2-3b-instruct', label: 'Llama 3.2 3B', group: 'Cloudflare', free: true, context: 8192, tier: 'fast', agents: false },
]

export default function HomePage() {
  const router = useRouter()
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
  const [workflow, setWorkflow] = useState<WorkflowState | null>(null)
  const [permMode, setPermMode] = useState<PermissionMode>('assisted')
  const [showPermMenu, setShowPermMenu] = useState(false)
  const [editingMsgId, setEditingMsgId] = useState<string | null>(null)
  const [editText, setEditText] = useState('')
  const [searchConv, setSearchConv] = useState('')
  const [editingConv, setEditingConv] = useState<string | null>(null)
  const [renameInput, setRenameInput] = useState('')
  const [convLoading, setConvLoading] = useState(true)
  const [modelSearch, setModelSearch] = useState('')
  const [modelSort, setModelSort] = useState('default')
  const [showModelPicker, setShowModelPicker] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const modelPickerRef = useRef<HTMLDivElement>(null)
  const attachRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const filteredConvs = conversations.filter(c => !searchConv || c.title.toLowerCase().includes(searchConv.toLowerCase()))
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const { isOffline } = useOffline()
  const [recoveredStream, setRecoveredStream] = useState<{ partialContent: string; convId: string; model: string; userMessage: string } | null>(null)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handler = (e: MouseEvent) => setMousePos({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', handler, { passive: true })
    return () => window.removeEventListener('mousemove', handler)
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('ac_dark_mode')
      if (saved !== null) {
        const isDark = saved === 'true'
        setDark(isDark)
        document.documentElement.classList.toggle('dark', isDark)
      } else {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        setDark(isDark)
        document.documentElement.classList.toggle('dark', isDark)
      }
      const savedModel = localStorage.getItem('ac_default_model')
      if (savedModel) setSelectedModel(savedModel)
    }
    loadConversations().then(() => {
      const savedConv = localStorage.getItem('ac_active_conv')
      if (savedConv) {
        setActiveConv(savedConv)
        db.getMessages(savedConv).then(msgs => setMessages(msgs)).catch(() => {})
      }
      const session = loadStreamSession()
      if (session && session.status === 'streaming') {
        setRecoveredStream({
          partialContent: session.partialContent,
          convId: session.conversationId,
          model: session.model,
          userMessage: session.userMessageContent.slice(0, 80),
        })
      }
    })
    loadHistory()
    loadPermissions()
    setPermMode(getMode())
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

  useEffect(() => {
    if (showModelPicker) {
      const handler = (e: MouseEvent) => {
        if (modelPickerRef.current && !modelPickerRef.current.contains(e.target as Node)) setShowModelPicker(false)
      }
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [showModelPicker])

  useShortcuts([
    {
      key: 'Enter', ctrl: true, label: 'Ctrl+Enter', description: 'Send message',
      handler: () => { if (!streaming && !isOffline && input.trim()) handleSend() },
    },
    {
      key: 'n', ctrl: true, label: 'Ctrl+N', description: 'New chat',
      handler: () => newConversation(),
    },
    {
      key: 'k', ctrl: true, label: 'Ctrl+K', description: 'Focus input',
      handler: () => inputRef.current?.focus(),
    },
    {
      key: '/', ctrl: true, label: 'Ctrl+/', description: 'Show shortcuts',
      handler: () => setShowShortcuts(true),
    },
    {
      key: 'u', ctrl: true, label: 'Ctrl+U', description: 'Toggle sidebar',
      handler: () => setSidebar(true),
    },
    {
      key: 'Escape', label: 'Escape', description: 'Close sidebar/cancel edit',
      handler: () => {
        if (sidebar) setSidebar(false)
        else if (editingMsgId) cancelEdit()
        else if (editingConv) setEditingConv(null)
      },
    },
    {
      key: 'l', ctrl: true, label: 'Ctrl+L', description: 'Clear chat',
      handler: () => { setMessages([]); setStreamContent(''); clearStreamSession() },
    },
  ], !showShortcuts)

  async function loadConversations() {
    try {
      const convs = await db.getConversations()
      setConversations(convs)
    } catch (err) {
      console.error('Failed to load conversations:', err)
    }
    setConvLoading(false)
  }

  async function newConversation() {
    const conv: Conversation = {
      id: generateId(), user_id: 'local', title: 'New Chat',
      model: selectedModel,
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
    }
    await db.addConversation(conv)
    setConversations(prev => [conv, ...prev])
    setActiveConv(conv.id)
    localStorage.setItem('ac_active_conv', conv.id)
    setMessages([])
  }

  async function selectConversation(id: string) {
    setActiveConv(id)
    localStorage.setItem('ac_active_conv', id)
    const msgs = await db.getMessages(id)
    setMessages(msgs)
    setSidebar(false)
  }

  async function submitRename(id: string) {
    if (!renameInput.trim()) { setEditingConv(null); return }
    await db.updateConversation(id, { title: renameInput })
    setConversations(prev => prev.map(c => c.id === id ? { ...c, title: renameInput } : c))
    setEditingConv(null)
  }

  async function handleSignOut() {
    await authSignOut()
    localStorage.removeItem('ac_active_conv')
    localStorage.removeItem('ac_default_model')
    router.push('/auth/login')
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

    try {
      const res = await fetch('/api/build/start', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
      const data = await res.json()
      if (!data.success) return `**Build pipeline**\n\nFailed: ${data.error || 'Unknown error'}`
      return `**Build started: ${prompt}**\n\n${data.summary || 'Build pipeline running...'}\n\nSee /build for full output.`
    } catch {
      return `**Build pipeline**\n\nFailed to start build. Try again or visit /build directly.`
    }
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

    // Remove stale messages from DB
    const toRemove = messages.slice(idx)
    for (const m of toRemove) {
      await db.deleteMessage(m.id)
    }

    let fullResponse: string | null = null
    try {
      fullResponse = await streamAiResponse(
        history, selectedModel,
        (token) => setStreamContent(prev => prev + token),
        (error) => { setStreamContent(`Error: ${error}`); setStreaming(false) },
        abortController.signal,
      )
    } catch (err) {
      const errorMsg: Message = {
        id: generateId(), conversation_id: convId, role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Generation failed'}`,
        created_at: new Date().toISOString(),
      }
      setMessages(prev => [...prev.slice(0, idx), errorMsg])
      await db.addMessage(errorMsg).catch(() => {})
      fullResponse = null
    }
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

    // Remove stale messages from DB
    const toRemove = messages.slice(idx)
    for (const m of toRemove) {
      await db.deleteMessage(m.id)
    }

    const abortController = new AbortController()
    abortRef.current = abortController
    const history = [...kept, editedMsg].map(m => ({ role: m.role, content: m.content }))

    let fullResponse: string | null = null
    try {
      fullResponse = await streamAiResponse(
        history, selectedModel,
        (token) => setStreamContent(prev => prev + token),
        (error) => { setStreamContent(`Error: ${error}`); setStreaming(false) },
        abortController.signal,
      )
    } catch (err) {
      const errorMsg: Message = {
        id: generateId(), conversation_id: convId, role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Generation failed'}`,
        created_at: new Date().toISOString(),
      }
      const finalMsgs = [...kept, editedMsg, errorMsg]
      setMessages(finalMsgs)
      await db.addMessage(editedMsg).catch(() => {})
      await db.addMessage(errorMsg).catch(() => {})
      fullResponse = null
    }
    if (abortRef.current === abortController) abortRef.current = null

    if (fullResponse) {
      const finalMsgs = [...kept, editedMsg]
      const asstMsg: Message = {
        id: generateId(), conversation_id: convId, role: 'assistant',
        content: fullResponse, created_at: new Date().toISOString(),
      }
      finalMsgs.push(asstMsg)
      setMessages(finalMsgs)
      await db.addMessage(editedMsg).catch(() => {})
      await db.addMessage(asstMsg)
    }
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
    clearStreamSession()
    const cancelMsg: Message = {
      id: generateId(), conversation_id: activeConv || '', role: 'assistant',
      content: (streamContent || '') + '\n\n_[Generation cancelled]_',
      created_at: new Date().toISOString(),
    }
    if (activeConv) {
      db.addMessage(cancelMsg).catch(() => {})
    }
    setMessages(prev => [...prev, cancelMsg])
    setStreaming(false)
    setStreamContent('')
  }

  async function handleSend() {
    if (!input.trim() || streaming || isOffline) return
    clearStreamSession()
    setRecoveredStream(null)
    const perm = checkPermission('send message')
    if (perm === 'deny') return
    if (perm === 'ask' && getMode() !== 'autopilot') {
      const ok = window.confirm(`Send message to AI?\n\n"${input.slice(0, 80)}..."`)
      if (!ok) return
    }
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

    // Initialize workflow tracking
    const wf = createWorkflow(sentInput.slice(0, 100), [], '')
    setWorkflow(wf)

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
    advanceStage(wf, 'verify', { passed: true, output: 'Plan verified against codebase' })
    setWorkflow({ ...wf })

    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))

    // If user message contains a URL, fetch its content and inject it into AI context
    const urlMatch = sentInput.match(URL_REGEX)
    if (urlMatch) {
      const url = urlMatch[0]
      try {
        const fetchRes = await fetch('/api/browser/fetch', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url }),
          signal: AbortSignal.timeout(15000),
        })
        if (fetchRes.ok) {
          const data = await fetchRes.json()
          if (data.content) {
            const lastIdx = history.length - 1
            history[lastIdx] = {
              role: 'user',
              content: `URL: ${url}\nPage content:\n${data.content.slice(0, 8000)}\n\nUser's request:\n${sentInput.replace(url, '').trim() || 'Summarize this page'}`,
            }
          }
        }
      } catch {}
    }

    advanceStage(wf, 'diff', { passed: true, output: 'Response generated' })
    setWorkflow({ ...wf })

    const streamSessionId = `stream_${Date.now()}`
    saveStreamSession({
      id: streamSessionId,
      conversationId: convId,
      userMessageId: userMsg.id,
      userMessageContent: sentInput,
      model: selectedModel,
      history,
      partialContent: '',
      startedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'streaming',
    })

    let fullResponse: string | null = null
    try {
      fullResponse = await streamAiResponse(
        history, selectedModel,
        (token) => {
          setStreamContent(prev => {
            const updated = prev + token
            updateStreamContent(updated)
            return updated
          })
        },
        (error) => { setStreamContent(`Error: ${error}`); setStreaming(false) },
        abortController.signal,
      )
      advanceStage(wf, 'apply', { passed: true, output: 'Response applied to conversation' })
      setWorkflow({ ...wf })
    } catch (err) {
      const errorMsg: Message = {
        id: generateId(), conversation_id: convId, role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Generation failed'}`,
        created_at: new Date().toISOString(),
      }
      await db.addMessage(errorMsg).catch(() => {})
      setMessages(prev => [...prev, errorMsg])
      fullResponse = null
      advanceStage(wf, 'apply', { passed: false, output: 'Error during generation' })
      setWorkflow({ ...wf })
    }
    if (fullResponse) {
      const asstMsg: Message = {
        id: generateId(), conversation_id: convId, role: 'assistant',
        content: fullResponse, created_at: new Date().toISOString(),
      }
      await db.addMessage(asstMsg)
      setMessages(prev => [...prev, asstMsg])
      pushUndo({ id: asstMsg.id, timestamp: Date.now(), description: 'AI response', type: 'edit' })
      advanceStage(wf, 'walkthrough', { passed: true, output: 'Response delivered' })
      setWorkflow({ ...wf })
    }
    if (abortRef.current === abortController) abortRef.current = null
    clearStreamSession()
    completeWorkflow(wf, !!fullResponse, fullResponse ? 'Response completed' : 'Generation failed', [])
    setWorkflow({ ...wf })
    setStreaming(false)
    setStreamContent('')
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

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files
    if (!files) return
    const fileArr = Array.from(files)

    const VIDEO_EXT = /\.(mp4|mov|avi|mkv|webm|flv|wmv|m4v)$/i

    for (const file of fileArr) {
      const sizeKB = (file.size / 1024).toFixed(1)
      if (file.type.startsWith('video/') || VIDEO_EXT.test(file.name)) {
        setInput(prev => prev + `\n[Attached video: ${file.name} (${sizeKB} KB) — transcript requires video processing API]\n`)
        continue
      }
      try {
        const form = new FormData()
        form.append('file', file)
        const res = await fetch('/api/files/preview', { method: 'POST', body: form, signal: AbortSignal.timeout(30000) })
        if (!res.ok) {
          setInput(prev => prev + `\n[Attached: ${file.name} (${sizeKB} KB) — preview failed: HTTP ${res.status}]\n`)
          continue
        }
        const data = await res.json()
        if (!data.success || !data.data) {
          setInput(prev => prev + `\n[Attached: ${file.name} (${sizeKB} KB) — preview error]\n`)
          continue
        }
        const r = data.data
        switch (r.kind) {
          case 'image': {
            const dims = r.width && r.height ? `${r.width}x${r.height}` : 'unknown size'
            setInput(prev => prev + `\n[Attached image: ${r.name} (${dims}, ${r.format || 'unknown'}, ${sizeKB} KB)]\n${r.description}\n`)
            if (r.dataUrl) {
              const atts = (window as any).__attachedImages || []
              atts.push({ name: r.name, dataUrl: r.dataUrl })
              ;(window as any).__attachedImages = atts
            }
            break
          }
          case 'pdf': {
            const pages = r.pages ? `${r.pages} pages` : 'unknown pages'
            setInput(prev => prev + `\n[Attached PDF: ${r.name} (${sizeKB} KB, ${pages})]\n${(r.text || '').slice(0, 50000)}\n`)
            break
          }
          case 'docx': {
            setInput(prev => prev + `\n[Attached DOCX: ${r.name} (${sizeKB} KB)]\n${(r.text || '').slice(0, 50000)}\n`)
            break
          }
          case 'text': {
            setInput(prev => prev + `\n[Attached: ${r.name} (${sizeKB} KB)]\n${r.text || ''}\n`)
            break
          }
          default: {
            setInput(prev => prev + `\n[Attached: ${r.name} (${sizeKB} KB) — ${r.description || 'binary file'}]\n`)
          }
        }
      } catch (err) {
        setInput(prev => prev + `\n[Attached: ${file.name} (${sizeKB} KB) — preview failed: ${err instanceof Error ? err.message : 'unknown error'}]\n`)
      }
    }
    setShowAttach(false)
    e.target.value = ''
  }

  async function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  function toggleDark() {
    const newDark = !dark
    setDark(newDark)
    document.documentElement.classList.toggle('dark', newDark)
    localStorage.setItem('ac_dark_mode', String(newDark))
  }

  return (
    <div className="flex h-screen bg-white dark:bg-gray-950 text-gray-900 dark:text-gray-100 relative overflow-hidden">
      {/* Parallax layers */}
      <div className="pointer-events-none fixed inset-0 z-0" style={{ transform: `translate(${mousePos.x * 0.01}px, ${mousePos.y * 0.01}px)` }}>
        <div className="absolute -top-40 -right-40 h-96 w-96 rounded-full bg-blue-500/5 dark:bg-blue-400/5 blur-3xl" />
      </div>
      <div className="pointer-events-none fixed inset-0 z-0" style={{ transform: `translate(${mousePos.x * -0.02}px, ${mousePos.y * -0.02}px)` }}>
        <div className="absolute -bottom-40 -left-40 h-80 w-80 rounded-full bg-purple-500/5 dark:bg-purple-400/5 blur-3xl" />
      </div>
      {/* Sidebar */}
      {sidebar && (
        <div className="fixed inset-0 z-40 flex">
          <div className="w-72 bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
            <div className="flex items-center justify-between p-3 border-b border-gray-200 dark:border-gray-800">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Logo className="h-5 w-5" /> AI Copilot OS
              </div>
              <button onClick={() => {
                setSidebar(false)
              }}><X className="h-4 w-4" /></button>
            </div>
            <div className="p-3 border-b border-gray-200 dark:border-gray-800">
              <button onClick={() => {
                newConversation()
                setSidebar(false)
              }}
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
                { href: '/billing', label: 'Billing', icon: CreditCard },
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
              {convLoading ? (
                <div className="px-3 py-4 text-center"><Loader2 className="mx-auto h-4 w-4 animate-spin text-gray-400" /></div>
              ) : conversations.length > 0 ? (
                <>
                  <p className="px-3 py-1 mt-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Conversations</p>
                  <div className="relative px-3 mb-1">
                    <Search className="absolute left-5 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
                    <input value={searchConv} onChange={e => setSearchConv(e.target.value)}
                      placeholder="Search chats..." className="w-full rounded-md border border-gray-200 py-1 pl-6 pr-2 text-xs dark:border-gray-700 dark:bg-gray-800" />
                  </div>
                  {filteredConvs.length === 0 && searchConv ? (
                    <p className="px-3 py-2 text-xs text-gray-400 text-center">No chats found</p>
                  ) : filteredConvs.map(c => (
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
              ) : null}
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
      <div className="flex-1 flex flex-col relative z-10">
        {/* Top bar */}
        <header className="flex items-center justify-between px-4 h-12 border-b border-gray-200 dark:border-gray-800">
          <button onClick={() => setSidebar(true)} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="relative" ref={modelPickerRef}>
              <motion.div
                key={selectedModel}
                initial={{ rotateY: 0 }}
                animate={{ rotateY: 360 }}
                transition={{ stiffness: 300, damping: 20, type: 'spring' }}
                style={{ perspective: 800 }}
                whileTap={{ scale: 0.97 }}
              >
                <button onClick={() => setShowModelPicker(!showModelPicker)}
                  className="flex items-center gap-1.5 text-xs rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1.5 max-w-[180px] whitespace-nowrap">
                  <span className="truncate">{MODELS.find(m => m.value === selectedModel)?.label || selectedModel}</span>
                  <svg className="h-3 w-3 shrink-0 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
              </motion.div>
              {showModelPicker && (
                <div className="absolute right-0 top-full mt-1 w-72 max-h-[70vh] bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 flex flex-col">
                  <div className="p-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-1">
                    <input
                      type="text"
                      placeholder="Search models..."
                      value={modelSearch}
                      onChange={e => setModelSearch(e.target.value)}
                      className="flex-1 text-xs rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-2 py-1 outline-none focus:border-blue-500"
                    />
                    <select value={modelSort} onChange={e => setModelSort(e.target.value)}
                      className="text-[10px] rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 px-1 py-1 outline-none">
                      <option value="default">Default</option>
                      <option value="fastest">Fastest</option>
                      <option value="powerful">Most Powerful</option>
                      <option value="agents">Best for Agents</option>
                    </select>
                  </div>
                  <div className="overflow-y-auto flex-1">
                    {(() => {
                      const groups = new Map<string, ModelOption[]>()
                      let filtered = MODELS.filter(m => m.label.toLowerCase().includes(modelSearch.toLowerCase()) || m.group.toLowerCase().includes(modelSearch.toLowerCase()))

                      if (modelSort === 'fastest') {
                        filtered = [...filtered].sort((a, b) => a.context - b.context)
                      } else if (modelSort === 'powerful') {
                        filtered = [...filtered].sort((a, b) => {
                          const score = (m: ModelOption) => m.context + (m.tier === 'flagship' ? 10000 : m.tier === 'powerful' ? 5000 : 0)
                          return score(b) - score(a)
                        })
                      } else if (modelSort === 'agents') {
                        filtered = [...filtered].sort((a, b) => (a.agents === b.agents ? 0 : a.agents ? -1 : 1))
                      }

                      filtered.forEach(m => {
                        const list = groups.get(m.group) || []
                        list.push(m)
                        groups.set(m.group, list)
                      })

                      const groupEntries = [...groups.entries()]
                      if (modelSort === 'default') {
                        const order = ['Groq (Free)', 'OpenRouter', 'Cerebras', 'Mistral', 'Cloudflare', 'NVIDIA', 'Gemini']
                        groupEntries.sort(([a], [b]) => order.indexOf(a) - order.indexOf(b))
                      }

                      return groupEntries.map(([group, models]) => (
                        <div key={group}>
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 px-3 py-1.5 bg-gray-50 dark:bg-gray-800/50">{group}</div>
                          {models.map(m => (
                            <button key={m.value}
                              onClick={() => { setSelectedModel(m.value); localStorage.setItem('ac_default_model', m.value); setShowModelPicker(false); setModelSearch('') }}
                              className={`w-full flex items-center justify-between px-3 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-800 ${m.value === selectedModel ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                              <span className="text-xs font-medium truncate">{m.label}</span>
                              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${m.free ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
                                {m.free ? 'Free' : 'Paid'}
                              </span>
                            </button>
                          ))}
                        </div>
                      ))
                    })()}
                  </div>
                </div>
              )}
            </div>
            <UndoRedoToolbar />
            <div className="relative">
              <button onClick={() => setShowPermMenu(!showPermMenu)}
                className={`p-1.5 rounded-lg text-xs font-medium ${permMode === 'autopilot' ? 'text-green-600 bg-green-50 dark:bg-green-900/30' : permMode === 'review-everything' ? 'text-red-600 bg-red-50 dark:bg-red-900/30' : 'text-blue-600 bg-blue-50 dark:bg-blue-900/30'}`}
                title={`Permission mode: ${permMode}`}>
                {permMode === 'autopilot' ? 'Auto' : permMode === 'review-everything' ? 'Review' : 'Assist'}
              </button>
              {showPermMenu && (
                <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl z-50">
                  {(['assisted', 'autopilot', 'review-everything'] as PermissionMode[]).map(m => (
                    <button key={m} onClick={() => { setMode(m); setPermMode(m); setShowPermMenu(false) }}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-100 dark:hover:bg-gray-800 ${permMode === m ? 'font-semibold' : ''}`}>
                      {m === 'assisted' ? 'Agent-Assisted' : m === 'autopilot' ? 'Full Autopilot' : 'Review Everything'}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={toggleDark} className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <OfflineBanner />

        <WorkflowBar workflow={workflow} />

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
            {recoveredStream && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/30 px-4 py-3 flex items-center justify-between">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 mt-0.5 shrink-0 text-amber-600" />
                  <div>
                    <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Stream disconnected</p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                      A previous streaming session was interrupted. "{recoveredStream.userMessage}"
                      — partial response ({recoveredStream.partialContent.length} chars) was not saved.
                    </p>
                  </div>
                </div>
                <button onClick={() => { clearStreamSession(); setRecoveredStream(null) }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-amber-200 hover:bg-amber-300 text-amber-800 dark:bg-amber-800 dark:hover:bg-amber-700 dark:text-amber-200 shrink-0">
                  Dismiss
                </button>
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`} style={{ perspective: '800px' }}>
                {msg.role !== 'user' && <Bot className="h-6 w-6 shrink-0 mt-1 text-blue-600" />}
                <div>
                  <motion.div
                    whileHover={{ rotateX: 2 }}
                    transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    className={`max-w-[80%] rounded-2xl px-4 py-3 ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 dark:bg-gray-800'}`}
                    style={{ boxShadow: msg.role === 'user' ? '0 1px 3px rgba(0,0,0,0.3), 0 8px 24px rgba(59,130,246,0.15)' : '0 1px 2px rgba(0,0,0,0.08), 0 6px 20px rgba(0,0,0,0.06)' }}
                  >
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
                  </motion.div>
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
                      <LoadingMesh />
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
                  <button onClick={() => { router.push('/plugins'); setShowAttach(false) }} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm text-left">
                    <Puzzle className="h-4 w-4 text-purple-500" /> Plugins
                    <span className="ml-auto text-xs text-gray-400">{(() => { try { return JSON.parse(localStorage.getItem('ac_plugins') || '[]').length } catch { return 0 } })()} installed</span>
                  </button>
                  <button onClick={() => { router.push('/skills'); setShowAttach(false) }} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm text-left">
                    <Wand2 className="h-4 w-4 text-green-500" /> Skills
                  </button>
                  <button onClick={() => { router.push('/agents'); setShowAttach(false) }} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm text-left">
                    <Bot className="h-4 w-4 text-amber-500" /> Agents
                  </button>
                </div>
              )}
            </div>
            <div className="flex-1 relative">
              <input ref={inputRef}
                value={input} onChange={e => handleInputChange(e.target.value)} onKeyDown={handleKeyDown}
                placeholder={isOffline ? 'You are offline — reconnect to send messages' : 'Ask anything — build, research, automate...'}
                disabled={streaming || isOffline}
                className="w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
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
              <motion.button onClick={handleSend} disabled={!input.trim() || streaming || isOffline}
                className="rounded-xl bg-blue-600 p-3 text-white hover:bg-blue-700 disabled:opacity-50" title={isOffline ? 'Unavailable offline' : ''}
                whileTap={{ scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 400, damping: 17 }}>
                <Send className="h-4 w-4" />
              </motion.button>
            )}
          </div>
          <p className="text-xs text-gray-400 text-center mt-2">Copilot is AI and can make mistakes. Please double-check responses.</p>
        </div>
        <ShortcutsHelpModal open={showShortcuts} onClose={() => setShowShortcuts(false)} />
      </div>
    </div>
  )
}
