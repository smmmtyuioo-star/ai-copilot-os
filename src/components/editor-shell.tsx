'use client'
import { useState, useEffect, useCallback, useRef, ReactNode } from 'react'
import { File, Folder, ChevronRight, ChevronDown, Plus, X, Terminal, Code2, FileText, Image, FolderPlus, FilePlus, Save, Loader2, AlertCircle } from 'lucide-react'

interface FileNode {
  name: string
  type: 'file' | 'directory'
  path: string
  children?: FileNode[]
  language?: string
}

interface Tab {
  id: string
  name: string
  path: string
  language: string
  content: string
  modified: boolean
}

interface TerminalLine {
  id: string
  text: string
  type: 'input' | 'output' | 'error' | 'system'
  timestamp: number
}

const FILE_ICONS: Record<string, string> = {
  ts: '📘', tsx: '⚛️', js: '📒', jsx: '⚛️',
  json: '📋', md: '📝', css: '🎨', html: '🌐',
  py: '🐍', rs: '🦀', go: '🔷',
  toml: '⚙️', yml: '⚙️', yaml: '⚙️',
  txt: '📄', csv: '📊', env: '🔒',
}

function getIcon(name: string, type: string): string {
  if (type === 'directory') return '📁'
  const ext = name.split('.').pop() || ''
  return FILE_ICONS[ext] || '📄'
}

function getLanguage(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const langMap: Record<string, string> = {
    ts: 'typescript', tsx: 'typescriptreact', js: 'javascript', jsx: 'javascriptreact',
    json: 'json', md: 'markdown', css: 'css', html: 'html',
    py: 'python', rs: 'rust', go: 'go', yml: 'yaml', yaml: 'yaml',
    toml: 'toml', env: 'dotenv', sh: 'shell', bash: 'shell',
  }
  return langMap[ext] || 'plaintext'
}

export function EditorShell() {
  const [files, setFiles] = useState<FileNode[]>([])
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [loadingFiles, setLoadingFiles] = useState(true)
  const [terminalLines, setTerminalLines] = useState<TerminalLine[]>([
    { id: 'init', text: 'AI Copilot OS — Terminal Ready', type: 'system', timestamp: Date.now() },
    { id: 'cwd', text: `~ /workspace`, type: 'system', timestamp: Date.now() },
  ])
  const [terminalInput, setTerminalInput] = useState('')
  const [showTerminal, setShowTerminal] = useState(true)
  const [loadingFile, setLoadingFile] = useState<string | null>(null)
  const [fileError, setFileError] = useState<string | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)
  const terminalRef = useRef<HTMLDivElement>(null)

  const toggleDir = useCallback((path: string) => {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  const openFile = useCallback(async (node: FileNode) => {
    if (node.type === 'directory') { toggleDir(node.path); return }
    const existing = tabs.find(t => t.path === node.path)
    if (existing) { setActiveTab(existing.id); return }
    const newTab: Tab = {
      id: `tab_${Date.now()}`,
      name: node.name,
      path: node.path,
      language: getLanguage(node.name),
      content: '',
      modified: false,
    }
    setTabs(prev => [...prev, newTab])
    setActiveTab(newTab.id)
    setLoadingFile(node.path)
    setFileError(null)
    try {
      const res = await fetch('/api/files/read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: node.path }),
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      if (data.success && typeof data.content === 'string') {
        setTabs(prev => prev.map(t => t.path === node.path ? { ...t, content: data.content } : t))
      } else {
        throw new Error(data.error || 'Failed to read file')
      }
    } catch (err) {
      setFileError(err instanceof Error ? err.message : 'Failed to load file')
    } finally {
      setLoadingFile(null)
    }
  }, [tabs, toggleDir])

  const closeTab = useCallback((id: string) => {
    setTabs(prev => {
      const idx = prev.findIndex(t => t.id === id)
      const next = prev.filter(t => t.id !== id)
      if (activeTab === id) {
        const newIdx = Math.min(idx, next.length - 1)
        setActiveTab(next[newIdx]?.id || null)
      }
      return next
    })
  }, [activeTab])

  const saveCurrentFile = useCallback(async () => {
    const tab = tabs.find(t => t.id === activeTab)
    if (!tab || !tab.modified) return
    setSaving(tab.id)
    setSaveError(null)
    setSaveSuccess(null)
    try {
      const res = await fetch('/api/files/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: tab.path, content: tab.content }),
        signal: AbortSignal.timeout(10000),
      })
      const data = await res.json()
      if (data.success) {
        setTabs(prev => prev.map(t => t.id === tab.id ? { ...t, modified: false } : t))
        setSaveSuccess('Saved')
        setTimeout(() => setSaveSuccess(null), 2000)
      } else {
        throw new Error(data.error || 'Save failed')
      }
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save file')
    } finally {
      setSaving(null)
    }
  }, [tabs, activeTab])

  const runTerminalCommand = useCallback(async () => {
    const cmd = terminalInput.trim()
    if (!cmd) return

    setTerminalLines(prev => [...prev, { id: `cmd_${Date.now()}`, text: `$ ${cmd}`, type: 'input', timestamp: Date.now() }])
    setTerminalInput('')

    if (cmd === 'clear') {
      setTerminalLines([])
      return
    }

    try {
      const res = await fetch('/api/terminal/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command: cmd }),
        signal: AbortSignal.timeout(35000),
      })
      const data = await res.json()
      const output = data?.data?.output || '(no response)'
      const exitCode = data?.data?.exitCode
      setTerminalLines(prev => [...prev, {
        id: `out_${Date.now()}`,
        text: output,
        type: exitCode ? 'error' as const : 'output' as const,
        timestamp: Date.now(),
      }])
    } catch (err) {
      setTerminalLines(prev => [...prev, {
        id: `err_${Date.now()}`,
        text: `Connection error: ${err instanceof Error ? err.message : 'Failed to execute command'}`,
        type: 'error' as const,
        timestamp: Date.now(),
      }])
    }
  }, [terminalInput])

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [terminalLines])

  useEffect(() => {
    async function loadTree() {
      try {
        const res = await fetch('/api/files/tree', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
          signal: AbortSignal.timeout(10000),
        })
        if (res.ok) {
          const result = await res.json()
          if (result.success && result.data?.tree) {
            setFiles(result.data.tree)
          }
        }
      } catch (err) {
        console.error('editor-shell: failed to load file tree', err)
      } finally {
        setLoadingFiles(false)
      }
    }
    loadTree()
  }, [])

  function renderTree(nodes: FileNode[], depth = 0): ReactNode[] {
    return nodes.flatMap(node => {
      const isExpanded = expanded.has(node.path)
      const elements: ReactNode[] = []
      elements.push(
        <div
          key={node.path}
          className="flex cursor-pointer items-center gap-1 rounded px-1 py-0.5 text-xs hover:bg-gray-100 dark:hover:bg-gray-800"
          style={{ paddingLeft: `${depth * 16 + 4}px` }}
          onClick={() => openFile(node)}
        >
          {node.type === 'directory' ? (
            isExpanded ? <ChevronDown className="h-3 w-3 shrink-0 text-gray-400" /> : <ChevronRight className="h-3 w-3 shrink-0 text-gray-400" />
          ) : <span className="w-3" />}
          <span className="shrink-0">{getIcon(node.name, node.type)}</span>
          <span className="truncate text-gray-700 dark:text-gray-300">{node.name}</span>
        </div>
      )
      if (node.type === 'directory' && isExpanded && node.children) {
        elements.push(...renderTree(node.children, depth + 1))
      }
      return elements
    })
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        <div className="flex-1">
          <div className="flex items-center border-b border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800">
            {tabs.length === 0 ? (
              <div className="px-4 py-2 text-xs text-gray-400">No files open</div>
            ) : (
              <div className="flex overflow-x-auto">
                {tabs.map(tab => (
                  <div
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1 border-r border-gray-200 px-3 py-2 text-xs cursor-pointer whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-b-2 border-b-blue-500 bg-white text-blue-600 dark:bg-gray-900 dark:text-blue-400'
                        : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
                    }`}
                  >
                    <span>{getIcon(tab.name, 'file')}</span>
                    <span>{tab.name}</span>
                    {tab.modified && <span className="text-yellow-500">●</span>}
                    <button onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }} className="ml-1 rounded p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          {activeTab ? (
            <div className="flex-1 overflow-auto p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <FileText className="h-4 w-4" />
                <span>Editing: {tabs.find(t => t.id === activeTab)?.path}</span>
                <span className="rounded bg-gray-100 px-2 py-0.5 text-xs dark:bg-gray-800">{tabs.find(t => t.id === activeTab)?.language}</span>
                <div className="ml-auto flex items-center gap-2">
                  {loadingFile && <span className="flex items-center gap-1 text-xs text-blue-500"><Loader2 className="h-3 w-3 animate-spin" /> Loading...</span>}
                  {fileError && <span className="flex items-center gap-1 text-xs text-red-500"><AlertCircle className="h-3 w-3" /> {fileError}</span>}
                  {saveError && <span className="flex items-center gap-1 text-xs text-red-500"><AlertCircle className="h-3 w-3" /> {saveError}</span>}
                  {saveSuccess && <span className="text-xs text-green-500">{saveSuccess}</span>}
                  {tabs.find(t => t.id === activeTab)?.modified && (
                    <button onClick={saveCurrentFile} disabled={!!saving}
                      className="flex items-center gap-1 rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50">
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                      Save
                    </button>
                  )}
                </div>
              </div>
              <textarea
                className="mt-2 w-full flex-1 resize-none rounded border border-gray-200 p-3 font-mono text-sm dark:border-gray-700 dark:bg-gray-800"
                rows={16}
                placeholder="File content will appear here..."
                value={tabs.find(t => t.id === activeTab)?.content || ''}
                onChange={(e) => {
                  setTabs(prev => prev.map(t => t.id === activeTab ? { ...t, content: e.target.value, modified: true } : t))
                }}
              />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center text-sm text-gray-400">
              <div className="text-center">
                <Code2 className="mx-auto h-8 w-8" />
                <p className="mt-2">Select a file from the explorer to start editing</p>
              </div>
            </div>
          )}
        </div>
        <div className="w-64 border-l border-gray-200 dark:border-gray-700">
          <div className="border-b border-gray-200 px-3 py-2 text-xs font-medium text-gray-500 dark:border-gray-700">
            Explorer
          </div>
          <div className="overflow-auto p-2" style={{ maxHeight: '60vh' }}>
            {loadingFiles ? (
              <div className="py-8 text-center text-xs text-gray-400">Scanning files...</div>
            ) : files.length === 0 ? (
              <div className="py-8 text-center text-xs text-gray-400">No files in workspace</div>
            ) : (
              renderTree(files)
            )}
          </div>
        </div>
      </div>
      {showTerminal && (
        <div className="border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-3 py-1 dark:border-gray-700 dark:bg-gray-800">
            <div className="flex items-center gap-1">
              <Terminal className="h-3 w-3 text-gray-500" />
              <span className="text-xs text-gray-500">Terminal</span>
            </div>
            <button onClick={() => setShowTerminal(false)} className="rounded p-0.5 hover:bg-gray-200 dark:hover:bg-gray-700">
              <X className="h-3 w-3 text-gray-400" />
            </button>
          </div>
          <div ref={terminalRef} className="h-40 overflow-y-auto bg-gray-950 p-3 font-mono text-xs leading-5">
            {terminalLines.map(line => (
              <div key={line.id} className={`${
                line.type === 'input' ? 'text-green-400' :
                line.type === 'error' ? 'text-red-400' :
                line.type === 'system' ? 'text-blue-400' :
                'text-gray-300'
              }`}>
                {line.text}
              </div>
            ))}
          </div>
          <div className="flex border-t border-gray-800 bg-gray-950">
            <span className="px-2 py-1 text-xs text-green-400">$</span>
            <input
              value={terminalInput}
              onChange={(e) => setTerminalInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') runTerminalCommand() }}
              className="flex-1 border-0 bg-transparent px-2 py-1 text-xs text-gray-200 outline-none"
              placeholder="Type a command..."
            />
          </div>
        </div>
      )}
      {!showTerminal && (
        <button
          onClick={() => setShowTerminal(true)}
          className="flex items-center gap-1 border-t border-gray-200 px-3 py-1 text-xs text-gray-500 hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
        >
          <Terminal className="h-3 w-3" /> Terminal
        </button>
      )}
    </div>
  )
}
