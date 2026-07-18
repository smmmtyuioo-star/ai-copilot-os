'use client'
import { useState, useEffect, useCallback } from 'react'
import { FileText, Plus, Trash2, Play, Copy, Wand2, Loader2, CheckCircle2, AlertCircle, Sparkles } from 'lucide-react'
import { Button, Card, CardHeader, CardTitle, CardDescription, CardContent, Badge, Modal, Input } from '@/components/ui'
import { generateId } from '@/lib/utils'
import { skillRegistry } from '@/services/skill-registry'

interface Skill {
  id: string
  name: string
  description: string
  icon: string
  category: string
  systemPrompt: string
  builtIn: boolean
  inputLabel: string
  inputPlaceholder: string
}

const BUILT_IN_SKILLS: Skill[] = [
  { id: 'docx', name: 'Word Documents', description: 'Create, format, and edit .docx documents — reports, memos, letters, templates with headings, TOC, and professional formatting', icon: '📝', category: 'Documents', builtIn: true, inputLabel: 'Describe the document', inputPlaceholder: 'A professional business report about Q3 earnings with a cover page, TOC, and formatted sections...', systemPrompt: 'Generate a complete .docx document based on the description. Include: 1) Title page 2) Table of Contents 3) Formatted sections with headings (H1, H2, H3) 4) Professional styling. Output the complete document structure in Markdown format with clear section breaks.' },
  { id: 'pdf', name: 'PDF Documents', description: 'Read, extract, create PDFs — text extraction, form filling, merge/split, watermark, OCR-ready analysis', icon: '📄', category: 'Documents', builtIn: true, inputLabel: 'Describe the PDF', inputPlaceholder: 'A PDF contract with signature fields, watermarks, and numbered pages...', systemPrompt: 'Generate a structured PDF document plan. Include: 1) Page layout and dimensions 2) Content sections with page breaks 3) Form fields (if any) 4) Security/watermark requirements. Output as a structured Markdown document.' },
  { id: 'pptx', name: 'PowerPoint Decks', description: 'Create and edit .pptx presentations — slide decks, pitch decks, templates with speaker notes and animations', icon: '📊', category: 'Documents', builtIn: true, inputLabel: 'Describe the presentation', inputPlaceholder: 'A 10-slide pitch deck for a SaaS startup targeting Series A funding...', systemPrompt: 'Generate a complete PowerPoint presentation outline. For each slide provide: 1) Slide title 2) Content layout 3) Key talking points 4) Speaker notes. Output as structured Markdown with slide separators.' },
  { id: 'xlsx', name: 'Spreadsheets', description: 'Create, edit, and fix .xlsx/.csv spreadsheets — formulas, formatting, charts, data cleaning', icon: '📈', category: 'Documents', builtIn: true, inputLabel: 'Describe the spreadsheet', inputPlaceholder: 'A sales tracker with monthly revenue, formulas for YTD totals, and a pie chart by region...', systemPrompt: 'Generate a spreadsheet plan. Include: 1) Column headers and data types 2) Formulas and calculations 3) Chart recommendations 4) Conditional formatting rules. Output as a structured Markdown table.' },
  { id: 'file-reading', name: 'File Reader', description: 'Upload and analyze any file — extract text, identify format, summarize content, answer questions', icon: '🔍', category: 'Analysis', builtIn: true, inputLabel: 'Describe the file or paste content', inputPlaceholder: 'Upload a CSV of customer data and I will analyze trends, outliers, and insights...', systemPrompt: 'Analyze the given file content or description. Identify: 1) File type and format 2) Key data points 3) Structure and organization 4) Insights and recommendations. Be thorough.' },
  { id: 'frontend-design', name: 'Frontend Designer', description: 'Visual UI/UX design guidance — color palettes, layout, typography, component design for web apps', icon: '🎨', category: 'Design', builtIn: true, inputLabel: 'Describe the UI you want to build', inputPlaceholder: 'A dark-mode dashboard with a sidebar, stats cards, and a data table...', systemPrompt: 'You are a senior frontend designer. Given a UI description, provide: 1) Color palette with hex codes 2) Typography choices 3) Layout/component tree 4) Responsive behavior 5) Accessibility considerations. Output as structured Markdown.' },
  { id: 'product-knowledge', name: 'Product Knowledge', description: 'Verify facts about AI products, APIs, pricing, and features before stating them', icon: '🧠', category: 'Knowledge', builtIn: true, inputLabel: 'What do you want to verify?', inputPlaceholder: 'What are the latest features of GPT-4o? Tell me about Claude API pricing...', systemPrompt: 'You are a product knowledge base. Provide accurate, up-to-date information about AI products including: pricing, capabilities, API features, and limitations. If you are unsure about something, say so clearly. Cite specific details when possible.' },
  { id: 'pdf-reading', name: 'Deep PDF Reader', description: 'Deep PDF inspection — extract text, tables, images, form fields, scanned page analysis', icon: '📖', category: 'Analysis', builtIn: true, inputLabel: 'Describe the PDF or paste extracted text', inputPlaceholder: 'Scanned invoice PDF with vendor details, line items, totals, and a QR code...', systemPrompt: 'Perform deep PDF analysis. Extract and identify: 1) All text content with page locations 2) Table structures 3) Images and their context 4) Form fields and values 5) Metadata. Output as structured Markdown.' },
  { id: 'code-review', name: 'Code Reviewer', description: 'Review code for bugs, security, performance, and best practices across all languages', icon: '💻', category: 'Development', builtIn: true, inputLabel: 'Paste your code', inputPlaceholder: 'function processData(input) { return input.map(x => x * 2) }', systemPrompt: 'Review the provided code for: 1) Bugs and logic errors 2) Security vulnerabilities 3) Performance issues 4) Best practices violations 5) Improvement suggestions with code examples. Be thorough and specific.' },
  { id: 'api-design', name: 'API Designer', description: 'Design REST/GraphQL APIs — endpoints, schemas, validation, docs, error handling', icon: '🔌', category: 'Development', builtIn: true, inputLabel: 'Describe the API you need', inputPlaceholder: 'A REST API for a todo app with users, projects, and tasks...', systemPrompt: 'Design a complete API based on the description. Include: 1) Resource list with endpoints 2) Request/response schemas 3) Authentication approach 4) Error handling strategy 5) Rate limiting. Output as structured Markdown.' },
]

const CATEGORIES = ['all', 'Documents', 'Analysis', 'Design', 'Knowledge', 'Development']

export default function SkillsPage() {
  const [skills, setSkills] = useState<Skill[]>([])
  const [filter, setFilter] = useState('all')
  const [action, setAction] = useState<{ skill: Skill; loading: boolean; input: string; output: string; error: string } | null>(null)
  const [showCreator, setShowCreator] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPrompt, setNewPrompt] = useState('')
  const [newCategory, setNewCategory] = useState('Custom')
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  useEffect(() => {
    loadSkills()
    const unsub = skillRegistry.onChange(loadSkills)
    return unsub
  }, [])

  function loadSkills() {
    const custom = skillRegistry.getAll()
    setSkills([...BUILT_IN_SKILLS, ...custom.map(s => ({ ...s, builtIn: s.builtIn || BUILT_IN_SKILLS.some(b => b.id === s.id) }))])
  }

  function createSkill() {
    if (!newName.trim() || !newPrompt.trim()) return
    skillRegistry.manualCreate({
      name: newName, description: newDesc || `${newName} skill`,
      icon: '⚡', category: newCategory,
      inputLabel: `What do you want to ${newName}?`,
      inputPlaceholder: `Describe what ${newName} should do...`,
      systemPrompt: newPrompt, tags: [],
    })
    setShowCreator(false)
    setNewName(''); setNewDesc(''); setNewPrompt(''); setNewCategory('Custom')
    setMessage({ type: 'success', text: `Skill "${newName}" created!` })
    setTimeout(() => setMessage(null), 3000)
  }

  function deleteSkill(id: string) {
    if (BUILT_IN_SKILLS.find(s => s.id === id)) return
    if (skillRegistry.delete(id)) {
      loadSkills()
      if (action?.skill.id === id) setAction(null)
      setMessage({ type: 'success', text: 'Skill deleted' })
      setTimeout(() => setMessage(null), 3000)
    }
  }

  async function autoGenerateSkill() {
    const output = action?.output || ''
    const input = action?.input || ''
    if (!input && !output) return
    const skill = skillRegistry.register({
      taskDescription: input,
      taskOutput: output,
    })
    skillRegistry.incrementUsage(skill.id)
    loadSkills()
    setMessage({ type: 'success', text: `Skill "${skill.name}" auto-generated from task output!` })
    setTimeout(() => setMessage(null), 3000)
  }

  async function executeSkill() {
    if (!action || !action.input.trim()) return
    setAction({ ...action, loading: true, output: '', error: '' })

    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: action.skill.systemPrompt },
          { role: 'user', content: action.input },
        ],
      }),
    })

    if (response.ok && response.body) {
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let output = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        const lines = text.split('\n').filter(l => l.startsWith('data: '))
        for (const line of lines) {
          const data = line.slice(6)
          if (data === '[DONE]') break
          try { const parsed = JSON.parse(data); const token = parsed.choices?.[0]?.delta?.content || ''; output += token; setAction(prev => prev ? { ...prev, output: prev.output + token } : prev) } catch {}
        }
      }
    } else {
      setAction(prev => prev ? { ...prev, error: 'Skill execution failed. Check your API key.', loading: false } : prev)
    }
    setAction(prev => prev ? { ...prev, loading: false } : prev)
  }

  const filtered = filter === 'all' ? skills : skills.filter(s => s.category === filter)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Skills</h1>
          <p className="text-sm text-gray-500">AI-powered document, design, and development skills</p>
        </div>
        <Button onClick={() => setShowCreator(true)}><Wand2 className="h-4 w-4" /> Create Skill</Button>
      </div>

      {message && (
        <div className={`flex items-center gap-2 rounded-lg p-3 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
          {message.text}
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setFilter(c)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap ${filter === c ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-800'}`}>
            {c === 'all' ? 'All' : c} ({c === 'all' ? skills.length : skills.filter(s => s.category === c).length})
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map(skill => (
          <Card key={skill.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{skill.icon}</span>
                  <div>
                    <CardTitle className="text-sm">{skill.name}</CardTitle>
                    <CardDescription>{skill.category}</CardDescription>
                  </div>
                </div>
                <Badge variant={skill.builtIn ? 'success' : 'warning'}>{skill.builtIn ? 'Built-in' : 'Custom'}</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{skill.description}</p>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setAction({ skill, loading: false, input: '', output: '', error: '' })}>
                  <Play className="h-4 w-4" /> Use
                </Button>
                {!skill.builtIn && (
                  <Button size="sm" variant="danger" onClick={() => deleteSkill(skill.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {action && (
        <Modal open={!!action} onClose={() => setAction(null)} title={`${action.skill.icon} ${action.skill.name}`}>
          <div className="space-y-4">
            <p className="text-sm text-gray-600 dark:text-gray-400">{action.skill.description}</p>
            <div>
              <label className="block text-sm font-medium mb-1">{action.skill.inputLabel}</label>
              <textarea value={action.input} onChange={e => setAction(prev => prev ? { ...prev, input: e.target.value } : prev)}
                placeholder={action.skill.inputPlaceholder} rows={4}
                className="w-full rounded-lg border border-gray-300 p-3 text-sm dark:border-gray-600 dark:bg-gray-800" />
            </div>
            <Button onClick={executeSkill} className="w-full" loading={action.loading} disabled={!action.input.trim()}>
              <Play className="h-4 w-4" /> Execute
            </Button>
            {action.error && <p className="text-sm text-red-500">{action.error}</p>}
            {action.output && (
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-gray-900">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-gray-500">Output</span>
                  <div className="flex gap-2">
                    <button onClick={autoGenerateSkill} className="text-xs text-purple-600 hover:underline"><Sparkles className="h-3 w-3 inline" /> Save as Skill</button>
                    <button onClick={() => navigator.clipboard.writeText(action.output)} className="text-xs text-blue-600 hover:underline"><Copy className="h-3 w-3 inline" /> Copy</button>
                  </div>
                </div>
                <pre className="whitespace-pre-wrap text-sm max-h-80 overflow-y-auto">{action.output}</pre>
              </div>
            )}
          </div>
        </Modal>
      )}

      <Modal open={showCreator} onClose={() => setShowCreator(false)} title="Create Custom Skill">
        <div className="space-y-4">
          <Input id="skill-name" label="Skill Name" value={newName} onChange={e => setNewName(e.target.value)} placeholder="My Custom Skill" />
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} rows={2} className="w-full rounded-lg border border-gray-300 p-3 text-sm dark:border-gray-600 dark:bg-gray-800" placeholder="What does this skill do?" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="w-full rounded-lg border border-gray-300 p-2 text-sm dark:border-gray-600 dark:bg-gray-800">
              {['Custom', 'Documents', 'Analysis', 'Design', 'Knowledge', 'Development', 'Data'].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">System Prompt (instructions for AI)</label>
            <textarea value={newPrompt} onChange={e => setNewPrompt(e.target.value)} rows={6} className="w-full rounded-lg border border-gray-300 p-3 text-sm dark:border-gray-600 dark:bg-gray-800 font-mono" placeholder="You are a senior engineer. When given a task, analyze it step by step..." />
            <p className="mt-1 text-xs text-gray-400">This prompt defines how the AI behaves when using this skill. Be specific about what to include in the output.</p>
          </div>
          <Button onClick={createSkill} className="w-full" disabled={!newName.trim() || !newPrompt.trim()}>
            <Wand2 className="h-4 w-4" /> Create Skill
          </Button>
        </div>
      </Modal>
    </div>
  )
}
