'use client'
import { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui'
import { useAuth } from '@/hooks/useAuth'
import { streamAiResponse, saveMessage, getMessages, getConversations, createConversation, deleteConversation } from '@/services/chat'
import type { Conversation, Message } from '@/types'
import { formatDate, cn } from '@/lib/utils'

export default function ChatPage() {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [streamContent, setStreamContent] = useState('')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (user) loadConversations()
  }, [user])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamContent])

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

    await saveMessage(userMsg)

    const history = [...messages, userMsg].map(m => ({ role: m.role, content: m.content }))

    let fullResponse = ''
    await streamAiResponse(
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
      await saveMessage(assistantMsg)
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
          {messages.map(msg => (
            <div key={msg.id} className={cn('flex gap-3', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn(
                'max-w-[80%] rounded-xl px-4 py-2',
                msg.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100',
              )}>
                <p className="whitespace-pre-wrap text-sm">{msg.content}</p>
                <p className="mt-1 text-xs opacity-60">{formatDate(msg.created_at)}</p>
              </div>
            </div>
          ))}
          {streaming && streamContent && (
            <div className="flex gap-3 justify-start">
              <div className="max-w-[80%] rounded-xl bg-gray-100 px-4 py-2 dark:bg-gray-700">
                <p className="whitespace-pre-wrap text-sm text-gray-900 dark:text-gray-100">{streamContent}</p>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="border-t border-gray-200 p-4 dark:border-gray-700">
          <div className="flex gap-2">
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
