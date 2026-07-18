export interface WebhookConfig {
  id: string
  platform: 'slack' | 'discord' | 'generic'
  name: string
  webhookUrl: string
  signingSecret?: string
  enabled: boolean
  createdAt: string
  allowedCommands: string[]
}

export interface WebhookMessage {
  platform: string
  channel?: string
  user?: string
  text: string
  raw: Record<string, unknown>
  timestamp: string
}

export interface WebhookResponse {
  success: boolean
  message?: string
  reply?: string
}

export interface ChatPlatformConfig {
  platform: 'slack' | 'discord' | 'generic'
  webhookUrl: string
  apiKey?: string
  botName: string
}

class WebhookHandler {
  private configs: ChatPlatformConfig[] = []
  private rateLimitMap: Map<string, number[]> = new Map()
  private maxRequestsPerMinute = 20

  registerPlatform(config: ChatPlatformConfig): void {
    const existing = this.configs.findIndex(c => c.platform === config.platform)
    if (existing >= 0) {
      this.configs[existing] = config
    } else {
      this.configs.push(config)
    }
  }

  unregisterPlatform(platform: string): void {
    this.configs = this.configs.filter(c => c.platform !== platform)
  }

  async verifySignature(platform: string, body: string, signature: string): Promise<boolean> {
    if (platform === 'slack') {
      const config = this.configs.find(c => c.platform === 'slack')
      if (!config?.apiKey) return true
      const encoder = new TextEncoder()
      const key = await crypto.subtle.importKey('raw', encoder.encode(config.apiKey), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'])
      const expected = await crypto.subtle.sign('HMAC', key, encoder.encode(body))
      const expectedStr = Array.from(new Uint8Array(expected)).map(b => b.toString(16).padStart(2, '0')).join('')
      return signature === `v0=${expectedStr}`
    }
    return true
  }

  async handleMessage(platform: string, message: WebhookMessage): Promise<WebhookResponse> {
    if (!this.checkRateLimit(platform)) {
      return { success: false, message: 'Rate limit exceeded. Try again in a moment.' }
    }

    const config = this.configs.find(c => c.platform === platform)
    if (!config) {
      return { success: false, message: `Platform "${platform}" not configured` }
    }

    const text = message.text.trim()
    if (!text) {
      return { success: false, message: 'Empty message received' }
    }

    const response = await this.forwardToAi(text, platform)

    if (response && config.webhookUrl) {
      await this.sendReply(config, message.channel || message.user || '', response)
    }

    return { success: true, message: 'Processed', reply: response || undefined }
  }

  async handleStatusCheck(): Promise<{ status: string; platforms: string[]; uptime: string }> {
    return {
      status: 'operational',
      platforms: this.configs.map(c => c.platform),
      uptime: `${Math.floor(process.uptime())}s`,
    }
  }

  async handleLightweightRequest(request: string): Promise<string> {
    const lower = request.toLowerCase()
    if (lower.includes('status') || lower.includes('health')) {
      const status = await this.handleStatusCheck()
      return `Copilot status: ${status.status}. Connected platforms: ${status.platforms.join(', ') || 'none'}. Uptime: ${status.uptime}.`
    }
    if (lower.includes('version') || lower.includes('who are you')) {
      return 'I am AI Copilot OS — a full-stack AI engineering assistant accessible via chat.'
    }
    if (lower.includes('help') || lower.includes('commands')) {
      return 'Available commands: status, version, help, or send any coding question.'
    }
    return ''
  }

  async forwardToAi(text: string, platform: string): Promise<string | null> {
    const isStatusQuery = /^(status|health|version|who are you|help|commands)$/i.test(text.trim())
    if (isStatusQuery) {
      return this.handleLightweightRequest(text)
    }

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [
            { role: 'system', content: `You are AI Copilot OS responding via ${platform}. Keep responses concise and actionable.` },
            { role: 'user', content: text },
          ],
          stream: false,
        }),
      })

      if (!response.ok) return null
      const data = await response.json()
      return data.output || data.choices?.[0]?.message?.content || null
    } catch {
      return null
    }
  }

  async sendReply(config: ChatPlatformConfig, target: string, message: string): Promise<boolean> {
    try {
      let payload: Record<string, unknown>

      switch (config.platform) {
        case 'slack':
          payload = { channel: target, text: message, username: config.botName }
          break
        case 'discord':
          payload = { content: message, username: config.botName }
          break
        default:
          payload = { text: message, source: config.botName }
      }

      const response = await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      return response.ok
    } catch {
      return false
    }
  }

  async handleSlackPayload(body: Record<string, unknown>): Promise<WebhookResponse> {
    const text = (body.text as string) || (body.event as Record<string, unknown>)?.text as string || ''
    const channel = (body.channel_id as string) || (body.event as Record<string, unknown>)?.channel as string || ''
    const user = (body.user_name as string) || (body.event as Record<string, unknown>)?.user as string || ''

    return this.handleMessage('slack', { platform: 'slack', channel, user, text, raw: body, timestamp: new Date().toISOString() })
  }

  async handleDiscordPayload(body: Record<string, unknown>): Promise<WebhookResponse> {
    const text = (body.content as string) || ''
    const channel = (body.channel_id as string) || ''
    const user = ((body.author as Record<string, unknown>)?.username as string) || ((body.member as Record<string, unknown>)?.user as Record<string, unknown>)?.username as string || ''

    if (body.type && Number(body.type) === 1) {
      return { success: true, message: 'Pong' }
    }

    return this.handleMessage('discord', { platform: 'discord', channel, user, text, raw: body, timestamp: new Date().toISOString() })
  }

  async sendStatusToAll(message: string): Promise<{ platform: string; sent: boolean }[]> {
    const results: { platform: string; sent: boolean }[] = []
    for (const config of this.configs) {
      const sent = await this.sendReply(config, '', message)
      results.push({ platform: config.platform, sent })
    }
    return results
  }

  private checkRateLimit(key: string): boolean {
    const now = Date.now()
    const window = 60000
    const timestamps = this.rateLimitMap.get(key) || []
    const recent = timestamps.filter(t => now - t < window)
    if (recent.length >= this.maxRequestsPerMinute) return false
    recent.push(now)
    this.rateLimitMap.set(key, recent)
    return true
  }

  getConfigs(): ChatPlatformConfig[] {
    return [...this.configs]
  }
}

export const webhookHandler = new WebhookHandler()
