export type PermissionAction = 'read' | 'write' | 'execute' | 'delete' | 'network'
export type PermissionLevel = 'allow' | 'ask' | 'deny'

interface PermissionRule {
  pattern: RegExp
  action: PermissionAction
  level: PermissionLevel
  label: string
}

const STORAGE_KEY = 'ac_permission_rules'
const MODE_KEY = 'ac_permission_mode'

let mode: 'autopilot' | 'assisted' | 'review-everything' = 'assisted'
let rules: PermissionRule[] = []

export function load(): void {
  if (typeof window === 'undefined') return
  try {
    const saved = JSON.parse(localStorage.getItem(MODE_KEY) || '"assisted"')
    mode = saved
  } catch { mode = 'assisted' }
  try {
    const savedRules = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
    rules = savedRules.map((r: any) => ({ ...r, pattern: new RegExp(r.pattern) }))
  } catch { rules = [] }
}

export function save(): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(MODE_KEY, JSON.stringify(mode))
  localStorage.setItem(STORAGE_KEY, JSON.stringify(
    rules.map(r => ({ ...r, pattern: r.pattern.source }))
  ))
}

export function getMode() { return mode }
export function setMode(m: typeof mode) { mode = m; save() }

export function getRules() { return rules }

export function addRule(label: string, pattern: string, action: PermissionAction, level: PermissionLevel): void {
  rules.push({ label, pattern: new RegExp(pattern, 'i'), action, level })
  save()
}

export function removeRule(index: number): void {
  rules.splice(index, 1)
  save()
}

export function checkPermission(action: string, toolName?: string): PermissionLevel {
  if (mode === 'autopilot') return 'allow'
  if (mode === 'review-everything') return 'ask'

  for (const rule of rules) {
    if (toolName && rule.pattern.test(toolName)) return rule.level
    if (!toolName && rule.pattern.test(action)) return rule.level
  }

  if (toolName) {
    const writeTools = ['write', 'edit', 'create', 'delete', 'remove', 'shell', 'execute']
    const isWrite = writeTools.some(w => toolName.toLowerCase().includes(w))
    if (isWrite) return 'ask'
  }

  return 'allow'
}

export function requiresConfirmation(toolName: string): boolean {
  return checkPermission('', toolName) === 'ask'
}

export function getDefaultRules() {
  return [
    { label: 'Read operations', pattern: '^(read|list|get|search|find|grep|glob|fetch|web_search)', action: 'read' as PermissionAction, level: 'allow' as PermissionLevel },
    { label: 'Write operations', pattern: '^(write|edit|create|add|save|update)', action: 'write' as PermissionAction, level: 'ask' as PermissionLevel },
    { label: 'Delete operations', pattern: '^(delete|remove|destroy|clean|purge)', action: 'delete' as PermissionAction, level: 'deny' as PermissionLevel },
    { label: 'Shell execution', pattern: '^(shell|execute|run|bash|exec)', action: 'execute' as PermissionAction, level: 'ask' as PermissionLevel },
    { label: 'Network calls', pattern: '^(web_fetch|web_search|api_call|fetch_url)', action: 'network' as PermissionAction, level: 'allow' as PermissionLevel },
  ]
}
