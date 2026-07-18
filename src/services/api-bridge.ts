type SurfaceType = 'cli' | 'ide' | 'desktop' | 'chat' | 'web'

interface BridgeRequest {
  id: string
  surface: SurfaceType
  action: string
  payload: Record<string, unknown>
  timestamp: number
  auth?: { token: string; userId: string }
}

interface BridgeResponse {
  id: string
  success: boolean
  data?: unknown
  error?: string
  surface: SurfaceType
  timestamp: number
}

interface SurfaceSession {
  id: string
  surface: SurfaceType
  userId: string
  connectedAt: number
  lastActivity: number
  metadata: Record<string, unknown>
}

interface BridgeConfig {
  authEnabled: boolean
  maxSessionsPerUser: number
  sessionTimeout: number
}

const DEFAULT_CONFIG: BridgeConfig = {
  authEnabled: true,
  maxSessionsPerUser: 5,
  sessionTimeout: 3600000,
}

class ApiBridge {
  private sessions: Map<string, SurfaceSession> = new Map()
  private pendingRequests: Map<string, { request: BridgeRequest; resolve: (res: BridgeResponse) => void; timeout: ReturnType<typeof setTimeout> }> = new Map()
  private listeners: Map<string, Set<(request: BridgeRequest) => Promise<BridgeResponse>>> = new Map()
  private config: BridgeConfig
  private surfaces: Map<SurfaceType, { name: string; description: string; connected: boolean }> = new Map()

  constructor(config: Partial<BridgeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.registerSurface('cli', 'Command Line Interface', true)
    this.registerSurface('ide', 'IDE Extension (VS Code, JetBrains)', true)
    this.registerSurface('desktop', 'Desktop Application (Tauri, Electron)', false)
    this.registerSurface('chat', 'Chat Platform (Slack, Discord)', false)
    this.registerSurface('web', 'Web Interface (default)', true)
  }

  private registerSurface(type: SurfaceType, name: string, connected: boolean): void {
    this.surfaces.set(type, { name, description: `${name} surface`, connected })
  }

  async authenticate(surface: SurfaceType, credentials: { token?: string; apiKey?: string; userId: string }): Promise<{ sessionId: string; token: string }> {
    const sessionId = `sess_${surface}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

    const userSessions = [...this.sessions.values()].filter(s => s.userId === credentials.userId)
    if (userSessions.length >= this.config.maxSessionsPerUser) {
      const oldest = userSessions.sort((a, b) => a.connectedAt - b.connectedAt)[0]
      this.sessions.delete(oldest.id)
    }

    const token = credentials.token || `tok_${crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)}`
    this.sessions.set(sessionId, {
      id: sessionId, surface, userId: credentials.userId,
      connectedAt: Date.now(), lastActivity: Date.now(),
      metadata: {},
    })

    this.surfaces.set(surface, { ...this.surfaces.get(surface)!, connected: true })

    return { sessionId, token }
  }

  async sendRequest(request: Omit<BridgeRequest, 'id' | 'timestamp'>): Promise<BridgeResponse> {
    const fullRequest: BridgeRequest = {
      ...request,
      id: `req_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: Date.now(),
    }

    const handler = this.getHandler(request.action)
    if (handler) {
      try {
        const result = await handler(fullRequest)
        return result
      } catch (err) {
        return { id: fullRequest.id, success: false, error: err instanceof Error ? err.message : 'Handler error', surface: request.surface, timestamp: Date.now() }
      }
    }

    if (this.listeners.has(request.action)) {
      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          this.pendingRequests.delete(fullRequest.id)
          resolve({ id: fullRequest.id, success: false, error: 'Request timed out', surface: request.surface, timestamp: Date.now() })
        }, 30000)

        this.pendingRequests.set(fullRequest.id, { request: fullRequest, resolve, timeout })
      })
    }

    return { id: fullRequest.id, success: false, error: `No handler for action: ${request.action}`, surface: request.surface, timestamp: Date.now() }
  }

  async handleResponse(responseId: string, data: unknown, error?: string): Promise<void> {
    const pending = this.pendingRequests.get(responseId)
    if (!pending) return

    clearTimeout(pending.timeout)
    this.pendingRequests.delete(responseId)

    pending.resolve({
      id: responseId,
      success: !error,
      data,
      error,
      surface: pending.request.surface,
      timestamp: Date.now(),
    })
  }

  on(action: string, handler: (request: BridgeRequest) => Promise<BridgeResponse>): () => void {
    if (!this.listeners.has(action)) {
      this.listeners.set(action, new Set())
    }
    this.listeners.get(action)!.add(handler)
    return () => this.listeners.get(action)?.delete(handler)
  }

  private getHandler(action: string): ((req: BridgeRequest) => Promise<BridgeResponse>) | null {
    const actionHandlers: Record<string, (req: BridgeRequest) => Promise<BridgeResponse>> = {
      'chat.send': async (req) => {
        const message = req.payload.message as string
        if (!message) return { id: req.id, success: false, error: 'Message is required', surface: req.surface, timestamp: Date.now() }
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ai/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model: (req.payload.model as string) || 'llama-3.3-70b-versatile', messages: [{ role: 'user', content: message }] }),
          })
          if (!response.ok) return { id: req.id, success: false, error: 'Chat API failed', surface: req.surface, timestamp: Date.now() }
          const data = await response.json()
          return { id: req.id, success: true, data: data.output || data.choices?.[0]?.message?.content, surface: req.surface, timestamp: Date.now() }
        } catch (err) {
          return { id: req.id, success: false, error: err instanceof Error ? err.message : 'Request failed', surface: req.surface, timestamp: Date.now() }
        }
      },
      'code.execute': async (req) => {
        const code = req.payload.code as string
        const language = (req.payload.language as string) || 'typescript'
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/code/execute`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ code, language }),
          })
          const data = await response.json()
          return { id: req.id, success: response.ok, data, error: data.error, surface: req.surface, timestamp: Date.now() }
        } catch (err) {
          return { id: req.id, success: false, error: err instanceof Error ? err.message : 'Execution failed', surface: req.surface, timestamp: Date.now() }
        }
      },
      'status': async (req) => {
        return {
          id: req.id, success: true,
          data: { status: 'ok', surfaces: Object.fromEntries(this.surfaces), sessions: this.sessions.size },
          surface: req.surface, timestamp: Date.now(),
        }
      },
      'models.list': async (req) => {
        try {
          const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ai/parallel`, { method: 'GET' })
          const data = await response.json()
          return { id: req.id, success: true, data, surface: req.surface, timestamp: Date.now() }
        } catch (err) {
          return { id: req.id, success: false, error: err instanceof Error ? err.message : 'Failed to list models', surface: req.surface, timestamp: Date.now() }
        }
      },
    }
    return actionHandlers[action] || null
  }

  getActiveSessions(surface?: SurfaceType): SurfaceSession[] {
    const all = [...this.sessions.values()]
    const valid = all.filter(s => Date.now() - s.lastActivity < this.config.sessionTimeout)
    if (surface) return valid.filter(s => s.surface === surface)
    this.cleanup()
    return valid
  }

  getSurfaceStatus(): Record<string, { name: string; connected: boolean }> {
    return Object.fromEntries(
      [...this.surfaces.entries()].map(([key, val]) => [key, { name: val.name, connected: val.connected }])
    )
  }

  disconnectSession(sessionId: string): void {
    this.sessions.delete(sessionId)
  }

  disconnectSurface(surface: SurfaceType): void {
    for (const [id, session] of this.sessions) {
      if (session.surface === surface) this.sessions.delete(id)
    }
    this.surfaces.set(surface, { ...this.surfaces.get(surface)!, connected: false })
  }

  private cleanup(): void {
    const now = Date.now()
    for (const [id, session] of this.sessions) {
      if (now - session.lastActivity > this.config.sessionTimeout) {
        this.sessions.delete(id)
      }
    }
  }

  generateCliSnippet(): string {
    return `# AI Copilot OS CLI
# Copy your session token and use:
export COPILOT_TOKEN="your-session-token"
export COPILOT_URL="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}"

# Send a chat message
curl -X POST "$COPILOT_URL/api/bridge" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $COPILOT_TOKEN" \\
  -d '{"surface":"cli","action":"chat.send","payload":{"message":"Hello"}}'

# Execute code
curl -X POST "$COPILOT_URL/api/bridge" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $COPILOT_TOKEN" \\
  -d '{"surface":"cli","action":"code.execute","payload":{"code":"console.log(42)","language":"typescript"}}'

# Check status
curl -X POST "$COPILOT_URL/api/bridge" \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer $COPILOT_TOKEN" \\
  -d '{"surface":"cli","action":"status","payload":{}}'`
  }

  generateVsCodeExtensionSnippet(): string {
    return `// VS Code Extension - Contribute this to package.json:
// "contributes": {
//   "commands": [{
//     "command": "copilotOS.sendMessage",
//     "title": "Copilot OS: Send Message"
//   }]
// }

import * as vscode from 'vscode'

const COPILOT_URL = '${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}'
let sessionToken = ''

export function activate(context: vscode.ExtensionContext) {
  const disposable = vscode.commands.registerCommand('copilotOS.sendMessage', async () => {
    const message = await vscode.window.showInputBox({ prompt: 'Ask Copilot OS' })
    if (!message) return

    const response = await fetch(\`\${COPILOT_URL}/api/bridge\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': \`Bearer \${sessionToken}\` },
      body: JSON.stringify({ surface: 'ide', action: 'chat.send', payload: { message } }),
    })

    const result = await response.json()
    if (result.success) {
      const panel = vscode.window.createOutputChannel('Copilot OS')
      panel.appendLine(result.data)
      panel.show()
    }
  })

  context.subscriptions.push(disposable)
}`
  }
}

export const apiBridge = new ApiBridge()
