'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Plus, Trash2, Upload, Puzzle, Wand2, Paperclip, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { streamAiResponse, saveMessage, getMessages, getConversations, createConversation, deleteConversation } from '@/services/chat'
import { getActiveCredentialId } from '@/lib/credentials'
import type { Conversation, Message } from '@/types'
import { formatDate, cn } from '@/lib/utils'

const THINKING_STAGES = ['Analyzing', 'Thinking', 'Building', 'Processing', 'Researching', 'Crafting']

export default function ChatPage() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [thinkStage, setThinkStage] = useState(0)
  const [streamContent, setStreamContent] = useState('')
  const [showAttach, setShowAttach] = useState(false)
  const attachRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user) loadConversations()
  }, [user])

  useEffect(() => {
    if (showAttach) {
      const handler = (e: MouseEvent) => {
        if (attachRef.current && !attachRef.current.contains(e.target as Node)) setShowAttach(false)
      }
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }
  }, [showAttach])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamContent])

  useEffect(() => {
    if (!streaming) { setThinkStage(0); return }
    const interval = setInterval(() => setThinkStage(prev => (prev + 1) % THINKING_STAGES.length), 1800)
    return () => clearInterval(interval)
  }, [streaming])

  async function loadConversations() {
    if (!user) return
    const convs = await getConversations(user.id)
    setConversations(convs)
  }

  async function selectConversation(id: string) {
    setActiveConv(id)
    const msgs = await getMessages(id)
    setMessages(msgs)
  }

  async function newConversation() {
    if (!user) return
    const conv = await createConversation(user.id, 'New Chat')
    setConversations(prev => [conv, ...prev])
    setActiveConv(conv.id)
    setMessages([])
  }

  async function handleDelete(id: string) {
    await deleteConversation(id)
    setConversations(prev => prev.filter(c => c.id !== id))
    if (activeConv === id) {
      setActiveConv(null)
      setMessages([])
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
      if (file.type.startsWith('text/') || file.type.includes('json') || file.name.endsWith('.md') || file.name.endsWith('.csv')) {
        reader.readAsText(file)
      } else if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        reader.readAsDataURL(file)
      } else {
        reader.readAsText(file)
      }
    })
    setShowAttach(false)
    e.target.value = ''
  }

  async function handleSend() {
    if (!input.trim() || !user || streaming) return

    let convId = activeConv
    if (!convId) {
      const conv = await createConversation(user.id, input.slice(0, 50))
      convId = conv.id
      setActiveConv(conv.id)
      setConversations(prev => [conv, ...prev])
    }

    const userMsg: Message = {
      id: crypto.randomUUID(),
      conversation_id: convId,
      role: 'user',
      content: input,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setStreaming(true)
    setStreamContent('')

    await saveMessage(userMsg, getActiveCredentialId() || undefined)

    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))

    const fullResponse = await streamAiResponse(
      history,
      undefined,
      (token) => { setStreamContent(prev => prev + token) },
      (error) => {
        setStreamContent(`Error: ${error}`)
        setStreaming(false)
      },
    )

    if (fullResponse) {
      const assistantMsg: Message = {
        id: crypto.randomUUID(),
        conversation_id: convId,
        role: 'assistant',
        content: fullResponse,
        created_at: new Date().toISOString(),
      }
      await saveMessage(assistantMsg, getActiveCredentialId() || undefined)
      setMessages(prev => [...prev, assistantMsg])
    }
    setStreaming(false)
    setStreamContent('')
  }

  return (
    <div className="flex h-[calc(100vh-7rem)] gap-4">
      <div className="w-64 shrink-0 space-y-2 overflow-y-auto rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800">
        <Button onClick={newConversation} className="w-full justify-start gap-2" variant="secondary" size="sm">
          <Plus className="h-4 w-4" /> New Chat
        </Button>
        {conversations.map(conv => (
          <div
            key={conv.id}
            className={cn(
              'group flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm',
              activeConv === conv.id
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/50 dark:text-blue-200'
                : 'text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700',
            )}
            onClick={() => selectConversation(conv.id)}
          >
            <span className="truncate">{conv.title}</span>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(conv.id) }}
              className="shrink-0 opacity-0 group-hover:opacity-100"
            >
              <Trash2 className="h-4 w-4 text-gray-400 hover:text-red-500" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex flex-1 flex-col rounded-xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && !streaming && (
            <div className="flex h-full items-center justify-center text-gray-500">
              <div className="text-center">
                <Bot className="mx-auto h-12 w-12 text-blue-600" />
                <p className="mt-4 text-lg font-medium text-gray-900 dark:text-gray-100">Start a conversation</p>
                <p className="text-sm">Ask me anything to get started</p>
              </div>
            </div>
          )}
          {messages.map(msg => {
            const localhostMatch = msg.role === 'assistant' ? msg.content.match(/(http:\/\/localhost:\d+)/) : null;
            return (
              <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[80%] rounded-xl px-4 py-2',
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100',
                  localhostMatch ? 'w-[80%]' : ''
                )}>
                  <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                  
                  {localhostMatch && (
                    <div className="mt-4 w-full h-[500px] border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden bg-white">
                      <div className="bg-gray-200 dark:bg-gray-800 px-3 py-2 text-xs font-mono text-gray-600 dark:text-gray-400 border-b border-gray-300 dark:border-gray-600 flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-green-500" />
                          Live Preview: {localhostMatch[1]}
                        </span>
                        <a href={localhostMatch[1]} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                          <ExternalLink className="h-3 w-3" /> Open
                        </a>
                      </div>
                      <iframe src={localhostMatch[1]} className="w-full h-[calc(100%-36px)] bg-white" />
                    </div>
                  )}

                  <p className="mt-1 text-xs opacity-60">{formatDate(msg.created_at)}</p>
                </div>
              </div>
            )
          })}
          {streaming && (
            <div className="flex gap-3 justify-start">
              <div className="relative shrink-0 mt-1">
                <Bot className="h-6 w-6 text-blue-600" />
                <span className="absolute -bottom-1 -right-1 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
                </span>
              </div>
              <div className="max-w-[80%] rounded-xl bg-gray-100 px-4 py-2 dark:bg-gray-700">
                {streamContent ? (
                  <>
                    <p className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">{streamContent}</p>
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

        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
          <div className="flex gap-2">
            <div ref={attachRef} className="relative">
              <button onClick={() => setShowAttach(!showAttach)} disabled={streaming}
                className="rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-2 text-gray-500 hover:text-gray-700 disabled:opacity-50">
                <Plus className="h-4 w-4" />
              </button>
              {showAttach && (
                <div className="absolute bottom-full left-0 mb-2 w-56 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-xl overflow-hidden">
                  <label className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer text-sm">
                    <Upload className="h-4 w-4 text-blue-500" /> Upload File
                    <input type="file" multiple onChange={handleFileUpload} className="hidden" />
                  </label>
                  <button onClick={() => { window.location.href = '/plugins'; setShowAttach(false) }} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm text-left">
                    <Puzzle className="h-4 w-4 text-purple-500" /> Plugins
                  </button>
                  <button onClick={() => { window.location.href = '/skills'; setShowAttach(false) }} className="flex items-center gap-3 w-full px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 text-sm text-left">
                    <Wand2 className="h-4 w-4 text-green-500" /> Skills
                  </button>
                </div>
              )}
            </div>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Type your message..."
              disabled={streaming}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100"
            />
            <Button onClick={handleSend} disabled={!input.trim() || streaming} loading={streaming}>
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
