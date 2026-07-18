// LSP Worker — provides completions, diagnostics, and hover info
// Runs in a separate thread so LSP processing doesn't block the UI

interface FileState {
  uri: string
  language: string
  text: string
  version: number
}

const files: Map<string, FileState> = new Map()
const diagnosticCache: Map<string, any[]> = new Map()

const KEYWORD_COMPLETIONS: Record<string, { label: string; kind: string; detail: string; insertText: string }[]> = {
  typescript: [
    { label: 'import', kind: 'Keyword', detail: 'import statement', insertText: 'import {  } from "";' },
    { label: 'export', kind: 'Keyword', detail: 'export statement', insertText: 'export ' },
    { label: 'interface', kind: 'Keyword', detail: 'interface declaration', insertText: 'interface  {\n}' },
    { label: 'type', kind: 'Keyword', detail: 'type alias', insertText: 'type  = ' },
    { label: 'async function', kind: 'Function', detail: 'async function', insertText: 'async function () {\n}' },
    { label: 'const', kind: 'Variable', detail: 'const declaration', insertText: 'const  = ' },
    { label: 'useState', kind: 'Function', detail: 'React useState hook', insertText: 'useState()' },
    { label: 'useEffect', kind: 'Function', detail: 'React useEffect hook', insertText: 'useEffect(() => {}, [])' },
  ],
  javascript: [
    { label: 'import', kind: 'Keyword', detail: 'import statement', insertText: 'import {  } from "";' },
    { label: 'export', kind: 'Keyword', detail: 'export statement', insertText: 'export ' },
    { label: 'function', kind: 'Function', detail: 'function declaration', insertText: 'function () {\n}' },
    { label: 'const', kind: 'Variable', detail: 'const declaration', insertText: 'const  = ' },
    { label: 'async function', kind: 'Function', detail: 'async function', insertText: 'async function () {\n}' },
  ],
  python: [
    { label: 'def', kind: 'Function', detail: 'function definition', insertText: 'def ():\n    ' },
    { label: 'class', kind: 'Class', detail: 'class definition', insertText: 'class :\n    ' },
    { label: 'import', kind: 'Keyword', detail: 'import statement', insertText: 'import ' },
    { label: 'from', kind: 'Keyword', detail: 'from import', insertText: 'from  import ' },
    { label: 'async def', kind: 'Function', detail: 'async function', insertText: 'async def ():\n    ' },
  ],
}

function getCompletions(text: string, line: number, column: number, language: string): any[] {
  const lines = text.split('\n')
  const currentLine = lines[line] || ''
  const prefix = currentLine.slice(0, column).toLowerCase()

  const keywords = KEYWORD_COMPLETIONS[language] || KEYWORD_COMPLETIONS.typescript || []
  const matched = keywords.filter(k => k.label.toLowerCase().startsWith(prefix) || k.label.toLowerCase().includes(prefix))

  const symbols = extractSymbols(text, language)
  const symbolMatches = symbols.filter(s => s.name.toLowerCase().startsWith(prefix) || s.name.toLowerCase().includes(prefix))
  const mappedSymbols = symbolMatches.map(s => ({
    label: s.name,
    kind: s.kind,
    detail: s.detail,
    insertText: s.name,
  }))

  return [...matched, ...mappedSymbols].slice(0, 20)
}

function extractSymbols(text: string, language: string): { name: string; kind: string; detail: string; line: number }[] {
  const symbols: { name: string; kind: string; detail: string; line: number }[] = []
  const lines = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]

    if (language === 'typescript' || language === 'javascript') {
      let m = l.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/)
      if (m) symbols.push({ name: m[1], kind: 'Function', detail: `function ${m[1]}`, line: i })
      m = l.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:\([^)]*\)\s*=>|async\s*\([^)]*\)\s*=>)/)
      if (m) symbols.push({ name: m[1], kind: 'Function', detail: `arrow function ${m[1]}`, line: i })
      m = l.match(/(?:export\s+)?(?:const|let|var)\s+(\w+)\s*[:=]/)
      if (m && !m[1].startsWith('_')) symbols.push({ name: m[1], kind: 'Variable', detail: `variable ${m[1]}`, line: i })
      m = l.match(/(?:export\s+)?interface\s+(\w+)/)
      if (m) symbols.push({ name: m[1], kind: 'Interface', detail: `interface ${m[1]}`, line: i })
      m = l.match(/(?:export\s+)?type\s+(\w+)/)
      if (m) symbols.push({ name: m[1], kind: 'Type', detail: `type ${m[1]}`, line: i })
      m = l.match(/(?:export\s+)?class\s+(\w+)/)
      if (m) symbols.push({ name: m[1], kind: 'Class', detail: `class ${m[1]}`, line: i })
    }

    if (language === 'python') {
      let m = l.match(/def\s+(\w+)/)
      if (m) symbols.push({ name: m[1], kind: 'Function', detail: `def ${m[1]}`, line: i })
      m = l.match(/class\s+(\w+)/)
      if (m) symbols.push({ name: m[1], kind: 'Class', detail: `class ${m[1]}`, line: i })
      m = l.match(/^\s*(\w+)\s*=\s*(?:'|"|\d|\{)/)
      if (m) symbols.push({ name: m[1], kind: 'Variable', detail: `variable ${m[1]}`, line: i })
    }
  }

  return symbols
}

function getDiagnostics(text: string, language: string, uri: string): any[] {
  const diagnostics: any[] = []
  const lines = text.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]

    if (language === 'typescript' || language === 'javascript') {
      if (l.includes('any') && !l.includes('// @ts-ignore')) {
        diagnostics.push({
          severity: 'warning',
          message: 'Using `any` type — consider using a more specific type',
          line: i, column: l.indexOf('any'),
          endLine: i, endColumn: l.indexOf('any') + 3,
          code: 'no-explicit-any',
          source: 'lsp-worker',
        })
      }
      if (l.match(/(console\.log|console\.error)\(/) && l.trimLeft().startsWith('console')) {
        diagnostics.push({
          severity: 'hint',
          message: 'Consider removing debug console statement',
          line: i, column: l.indexOf('console'),
          endLine: i, endColumn: l.indexOf('console') + 12,
          code: 'no-console',
          source: 'lsp-worker',
        })
      }
      if (l.includes('var ') && !l.includes('// eslint-disable')) {
        diagnostics.push({
          severity: 'warning',
          message: 'Use `const` or `let` instead of `var`',
          line: i, column: l.indexOf('var '),
          endLine: i, endColumn: l.indexOf('var ') + 4,
          code: 'no-var',
          source: 'lsp-worker',
        })
      }
    }

    const lineLength = l.length
    if (lineLength > 200) {
      diagnostics.push({
        severity: 'hint',
        message: `Line too long (${lineLength} characters). Consider breaking it up.`,
        line: i, column: 0, endLine: i, endColumn: lineLength,
        code: 'max-len',
        source: 'lsp-worker',
      })
    }
  }

  diagnosticCache.set(uri, diagnostics)
  return diagnostics
}

function getHoverInfo(text: string, line: number, column: number, language: string): any {
  const lines = text.split('\n')
  const targetLine = lines[line] || ''

  const wordMatch = targetLine.slice(column).match(/^(\w+)/)
  const word = wordMatch ? wordMatch[1] : ''

  if (!word) return null

  const symbols = extractSymbols(text, language)
  const symbol = symbols.find(s => s.name === word)
  if (symbol) {
    return { contents: `**${symbol.kind}** — ${symbol.detail}`, range: { start: { line, character: column }, end: { line, character: column + word.length } } }
  }

  return null
}

function getReferences(text: string, line: number, column: number, language: string): any[] {
  const lines = text.split('\n')
  const targetLine = lines[line] || ''
  const wordMatch = targetLine.slice(column).match(/^(\w+)/)
  const word = wordMatch ? wordMatch[1] : ''
  if (!word) return []

  const refs: any[] = []
  for (let i = 0; i < lines.length; i++) {
    let idx = lines[i].indexOf(word)
    while (idx >= 0) {
      refs.push({ uri: '', line: i, column: idx, lineLength: word.length, text: lines[i].trim() })
      idx = lines[i].indexOf(word, idx + 1)
    }
  }
  return refs
}

self.onmessage = function(ev) {
  const { type, uri, language, text, line, column } = ev.data

  try {
    switch (type) {
      case 'start':
        self.postMessage({ type: 'started', language })
        break

      case 'open':
      case 'change':
        if (uri && text !== undefined) {
          const existing = files.get(uri)
          files.set(uri, { uri, language: language || 'typescript', text, version: (existing?.version || 0) + 1 })
          const diagnostics = getDiagnostics(text, language, uri)
          self.postMessage({ type: 'diagnostics', uri, diagnostics })
        }
        break

      case 'close':
        files.delete(uri)
        diagnosticCache.delete(uri)
        break

      case 'completions': {
        const file = files.get(uri)
        const completions = file ? getCompletions(file.text, line, column, file.language) : []
        self.postMessage({ type: 'completions', uri, items: completions })
        break
      }

      case 'hover': {
        const file = files.get(uri)
        const info = file ? getHoverInfo(file.text, line, column, file.language) : null
        self.postMessage({ type: 'hover', uri, info })
        break
      }

      case 'references': {
        const file = files.get(uri)
        const refs = file ? getReferences(file.text, line, column, file.language) : []
        self.postMessage({ type: 'references', uri, refs })
        break
      }

      default:
        self.postMessage({ type: 'error', uri, error: `Unknown message type: ${type}` })
    }
  } catch (err) {
    self.postMessage({ type: 'error', uri, error: err instanceof Error ? err.message : 'Worker error' })
  }
}
