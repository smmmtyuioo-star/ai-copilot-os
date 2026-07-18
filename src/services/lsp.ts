export interface LspDiagnostic {
  severity: 'error' | 'warning' | 'info' | 'hint'
  message: string
  line: number
  column: number
  endLine: number
  endColumn: number
  code?: string
  source?: string
}

export interface LspCompletion {
  label: string
  kind: string
  detail?: string
  documentation?: string
  insertText?: string
}

export interface LspHoverInfo {
  contents: string
  range?: { start: { line: number; character: number }; end: { line: number; character: number } }
}

export interface LspDefinition {
  uri: string
  line: number
  column: number
}

export interface LspReference {
  uri: string
  line: number
  column: number
  lineLength: number
  text: string
}

type LspCallback = (event: { type: string; data: unknown }) => void

class LspClient {
  private servers: Map<string, { worker: Worker | null; status: 'starting' | 'running' | 'error'; capabilities: string[] }> = new Map()
  private diagnosticCache: Map<string, LspDiagnostic[]> = new Map()
  private listeners: Set<LspCallback> = new Set()
  private ready: Promise<void>

  constructor() {
    this.ready = Promise.resolve()
  }

  async startServer(language: string): Promise<boolean> {
    if (this.servers.has(language) && this.servers.get(language)?.status === 'running') return true

    this.servers.set(language, { worker: null, status: 'starting', capabilities: this.getCapabilities(language) })

    try {
      if (typeof Worker !== 'undefined') {
        try {
          const worker = new Worker(new URL('@/workers/lsp.worker', import.meta.url))
          this.servers.set(language, { worker, status: 'running', capabilities: this.getCapabilities(language) })
          worker.onmessage = (ev) => {
            if (ev.data.type === 'diagnostics') {
              const uri: string = ev.data.uri
              this.diagnosticCache.set(uri, ev.data.diagnostics as LspDiagnostic[])
              for (const cb of this.listeners) cb({ type: 'diagnostics', data: { uri, diagnostics: ev.data.diagnostics } })
            }
          }
          worker.postMessage({ type: 'start', language })
          return true
        } catch {
          this.servers.set(language, { worker: null, status: 'running', capabilities: this.getCapabilities(language) })
          return true
        }
      }
      this.servers.set(language, { worker: null, status: 'running', capabilities: this.getCapabilities(language) })
      return true
    } catch {
      this.servers.set(language, { worker: null, status: 'error', capabilities: [] })
      return false
    }
  }

  async stopServer(language: string): Promise<void> {
    const server = this.servers.get(language)
    if (server?.worker) {
      server.worker.terminate()
    }
    this.servers.delete(language)
  }

  async notifyFileOpen(uri: string, language: string, text: string): Promise<void> {
    const server = this.servers.get(language)
    if (server?.worker) {
      server.worker.postMessage({ type: 'open', uri, text })
    }
  }

  async notifyFileChange(uri: string, language: string, text: string): Promise<void> {
    const server = this.servers.get(language)
    if (server?.worker) {
      server.worker.postMessage({ type: 'change', uri, text })
    }
  }

  async notifyFileClose(uri: string, language: string): Promise<void> {
    const server = this.servers.get(language)
    if (server?.worker) {
      server.worker.postMessage({ type: 'close', uri })
    }
  }

  editWithDiagnostics(filePath: string, originalContent: string, proposedContent: string): { safe: boolean; diagnostics: LspDiagnostic[]; warnings: string[] } {
    const cacheKey = `file://${filePath}`
    const existingDiagnostics = this.diagnosticCache.get(cacheKey) || []
    const warnings: string[] = []

    for (const diag of existingDiagnostics) {
      if (diag.severity === 'error') {
        warnings.push(`Pre-existing error in ${filePath}:${diag.line}: ${diag.message}`)
      }
    }

    if (originalContent === proposedContent) {
      return { safe: true, diagnostics: existingDiagnostics, warnings }
    }

    const addedLines = proposedContent.split('\n')
    const removedLines = originalContent.split('\n')
    if (Math.abs(addedLines.length - removedLines.length) > 200) {
      warnings.push('Large diff detected — verify manually before applying')
    }

    return { safe: warnings.length === 0, diagnostics: existingDiagnostics, warnings }
  }

  async getDiagnostics(filePath: string): Promise<LspDiagnostic[]> {
    return this.diagnosticCache.get(`file://${filePath}`) || []
  }

  async getCompletions(filePath: string, line: number, column: number, language: string): Promise<LspCompletion[]> {
    const server = this.servers.get(language)
    if (!server?.worker) return this.fallbackCompletions(language)

    return new Promise((resolve) => {
      const handler = (ev: MessageEvent) => {
        if (ev.data.type === 'completions') {
          server.worker!.removeEventListener('message', handler)
          resolve((ev.data.items || []) as LspCompletion[])
        }
      }
      server.worker!.addEventListener('message', handler)
      server.worker!.postMessage({ type: 'completions', uri: `file://${filePath}`, line, column })
      setTimeout(() => { server.worker!.removeEventListener('message', handler); resolve([]) }, 3000)
    })
  }

  async getHoverInfo(filePath: string, line: number, column: number, language: string): Promise<LspHoverInfo | null> {
    const server = this.servers.get(language)
    if (!server?.worker) return null

    return new Promise((resolve) => {
      const handler = (ev: MessageEvent) => {
        if (ev.data.type === 'hover') {
          server.worker!.removeEventListener('message', handler)
          resolve((ev.data.info || null) as LspHoverInfo | null)
        }
      }
      server.worker!.addEventListener('message', handler)
      server.worker!.postMessage({ type: 'hover', uri: `file://${filePath}`, line, column })
      setTimeout(() => { server.worker!.removeEventListener('message', handler); resolve(null) }, 3000)
    })
  }

  async getReferences(filePath: string, line: number, column: number, language: string): Promise<LspReference[]> {
    const server = this.servers.get(language)
    if (!server?.worker) return []

    return new Promise((resolve) => {
      const handler = (ev: MessageEvent) => {
        if (ev.data.type === 'references') {
          server.worker!.removeEventListener('message', handler)
          resolve((ev.data.refs || []) as LspReference[])
        }
      }
      server.worker!.addEventListener('message', handler)
      server.worker!.postMessage({ type: 'references', uri: `file://${filePath}`, line, column })
      setTimeout(() => { server.worker!.removeEventListener('message', handler); resolve([]) }, 5000)
    })
  }

  async checkBeforeEdit(filePath: string, originalContent: string, newContent: string, language: string): Promise<{ safe: boolean; issues: string[] }> {
    const issues: string[] = []

    const diagResult = this.editWithDiagnostics(filePath, originalContent, newContent)
    issues.push(...diagResult.warnings)

    const deps = await this.traceDependencies(filePath, language)
    for (const dep of deps) {
      const depDiags = await this.getDiagnostics(dep)
      const errors = depDiags.filter(d => d.severity === 'error')
      if (errors.length > 0) {
        issues.push(`Change may affect ${dep}: ${errors.length} error(s) — ${errors[0].message}`)
      }
    }

    return { safe: issues.length === 0, issues }
  }

  private async traceDependencies(filePath: string, language: string): Promise<string[]> {
    if (language !== 'typescript' && language !== 'javascript') return []
    try {
      const content = await this.readFileContent(filePath)
      const imports: string[] = []
      const importRegex = /from\s+['"]([^'"]+)['"]/g
      let match
      while ((match = importRegex.exec(content)) !== null) {
        imports.push(match[1])
      }
      return imports.filter(i => i.startsWith('.') || i.startsWith('/'))
    } catch {
      return []
    }
  }

  private async readFileContent(filePath: string): Promise<string> {
    const response = await fetch(`/api/files?path=${encodeURIComponent(filePath)}`)
    if (!response.ok) return ''
    return response.text()
  }

  private fallbackCompletions(language: string): LspCompletion[] {
    if (language === 'typescript' || language === 'javascript') {
      return [
        { label: 'import', kind: 'Keyword', detail: 'import statement', insertText: 'import {  } from ""' },
        { label: 'export', kind: 'Keyword', detail: 'export statement', insertText: 'export ' },
        { label: 'function', kind: 'Keyword', detail: 'function declaration', insertText: 'function () {\n}' },
        { label: 'const', kind: 'Keyword', detail: 'const declaration', insertText: 'const  = ' },
        { label: 'async', kind: 'Keyword', detail: 'async function', insertText: 'async ' },
      ]
    }
    return []
  }

  private getCapabilities(language: string): string[] {
    const caps: string[] = ['diagnostics']
    if (language === 'typescript' || language === 'javascript') {
      caps.push('completions', 'hover', 'references', 'rename')
    }
    if (language === 'python') {
      caps.push('completions', 'hover')
    }
    return caps
  }

  getServerStatus(language: string): string {
    return this.servers.get(language)?.status || 'stopped'
  }

  getCachedDiagnostics(filePath: string): LspDiagnostic[] {
    return this.diagnosticCache.get(`file://${filePath}`) || []
  }

  onEvent(cb: LspCallback): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }
}

export const lspClient = new LspClient()
