interface SandboxRule {
  type: 'allow' | 'deny'
  pattern: string | RegExp
  reason: string
}

interface SandboxConfig {
  allowedPaths: string[]
  blockedPaths: string[]
  blockedCommands: string[]
  dangerousArgs: string[]
  maxCommandLength: number
  maxOutputSize: number
  defaultTimeout: number
}

const DEFAULT_CONFIG: SandboxConfig = {
  allowedPaths: [process.cwd(), 'C:\\Users\\Dell\\AppData\\Local\\Temp\\opencode'],
  blockedPaths: [],
  blockedCommands: [
    'rm -rf /', 'rm -rf ~', 'rmdir /s', 'deltree',
    'format', 'fdisk', 'diskpart', 'mkfs',
    'dd if=', ':(){ :|:& };:', 'chmod 777',
    'sudo rm', 'sudo dd', 'sudo fdisk',
    '> /dev/sda', '> /dev/sdb',
  ],
  dangerousArgs: [
    '--force', '-f', '--delete', '--remove',
    '--drop', '--purge', '--no-verify',
    '--allow-empty', '--force-with-lease',
  ],
  maxCommandLength: 5000,
  maxOutputSize: 1_000_000,
  defaultTimeout: 30000,
}

interface SandboxResult {
  allowed: boolean
  reason?: string
  sanitized?: string
}

class Sandbox {
  private rules: SandboxRule[] = []
  private config: SandboxConfig

  constructor(config: Partial<SandboxConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.addDefaultRules()
  }

  private addDefaultRules(): void {
    this.addRule({ type: 'deny', pattern: /rm\s+(-rf\s+)?(~|\/|\\\$\{HOME\}|\$HOME)/i, reason: 'Destructive recursive delete' })
    this.addRule({ type: 'deny', pattern: /(sudo|runas)\s+(rm|dd|fdisk|mkfs|format)/i, reason: 'Privileged destructive operation' })
    this.addRule({ type: 'deny', pattern: /force-push|force-with-lease/i, reason: 'Force push requires explicit confirmation' })
    this.addRule({ type: 'deny', pattern: /drop\s+(database|table|schema|index)/i, reason: 'Database drop requires explicit confirmation' })
    this.addRule({ type: 'deny', pattern: /truncate\s+(table|database)/i, reason: 'Truncate requires explicit confirmation' })
    this.addRule({ type: 'deny', pattern: /Remove-Item\s+-Recurse/i, reason: 'Destructive PowerShell remove' })
    this.addRule({ type: 'deny', pattern: /Start-Process\s+-FilePath/i, reason: 'Process start blocked by default' })
    this.addRule({ type: 'allow', pattern: /^(git|npm|npx|node|python|pip|dotnet|cargo)\s/, reason: 'Common tool allowed' })
    this.addRule({ type: 'allow', pattern: /^(ls|dir|cd|pwd|cat|type|echo|more|find|grep|rg|head|tail|wc)/i, reason: 'Read-only commands allowed' })
    this.addRule({ type: 'allow', pattern: /^New-Item/i, reason: 'File creation allowed' })
    this.addRule({ type: 'allow', pattern: /^Set-Content\s/i, reason: 'File write allowed' })
  }

  addRule(rule: SandboxRule): void {
    this.rules.push(rule)
  }

  removeRule(pattern: string | RegExp): void {
    this.rules = this.rules.filter(r => r.pattern !== pattern)
  }

  setConfig(config: Partial<SandboxConfig>): void {
    this.config = { ...this.config, ...config }
  }

  inspect(command: string): SandboxResult {
    const trimmed = command.trim()

    if (trimmed.length > this.config.maxCommandLength) {
      return { allowed: false, reason: `Command exceeds max length of ${this.config.maxCommandLength} characters` }
    }

    for (const blocked of this.config.blockedCommands) {
      if (trimmed.toLowerCase().includes(blocked.toLowerCase())) {
        return { allowed: false, reason: `Command matches blocked pattern: ${blocked.split(' ')[0]}...` }
      }
    }

    for (const rule of this.rules) {
      const matches = typeof rule.pattern === 'string'
        ? trimmed.toLowerCase().includes(rule.pattern.toLowerCase())
        : rule.pattern.test(trimmed)

      if (matches) {
        if (rule.type === 'deny') {
          return { allowed: false, reason: rule.reason }
        }
        if (rule.type === 'allow') {
          return { allowed: true, sanitized: trimmed }
        }
      }
    }

    for (const arg of this.config.dangerousArgs) {
      if (trimmed.includes(arg)) {
        return { allowed: false, reason: `Dangerous argument detected: ${arg} requires explicit confirmation` }
      }
    }

    return { allowed: true, sanitized: trimmed }
  }

  validateToolCall(toolName: string, args: Record<string, unknown>): SandboxResult {
    const commandStr = args.command as string || args.code as string || ''
    if (commandStr) return this.inspect(commandStr)

    const filePath = (args.filePath as string) || (args.path as string) || ''
    if (filePath) {
      const allowed = this.config.allowedPaths.some(p => filePath.startsWith(p))
      if (!allowed) {
        const blocked = this.config.blockedPaths.some(p => filePath.startsWith(p))
        if (blocked) return { allowed: false, reason: `File path blocked: ${filePath}` }
      }
    }

    return { allowed: true }
  }

  sanitize(command: string): string {
    const result = this.inspect(command)
    if (!result.allowed) throw new Error(`Command blocked: ${result.reason}`)
    return result.sanitized || command
  }
}

export const sandboxInstance = new Sandbox()
