export type PermissionMode = 'autopilot' | 'assisted' | 'review-everything'
export type PermissionScope = 'allow' | 'ask' | 'deny'

interface Rule {
  pattern: RegExp
  scope: PermissionScope
  label: string
}

const STORAGE_KEY = 'ac_permissions'

let mode: PermissionMode = 'assisted'
let rules: Rule[] = []

export function loadPermissions() {
  if (typeof window === 'undefined') return
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
    mode = saved.mode || 'assisted'
    rules = (saved.rules || []).map((r: any) => ({ ...r, pattern: new RegExp(r.pattern) }))
  } catch { mode = 'assisted'; rules = [] }
}

export function savePermissions() {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode,
      rules: rules.map(r => ({ ...r, pattern: r.pattern.source })),
    }))
  } catch (e) {
    console.error('[permissions] Failed to save:', e)
  }
}

export function getMode(): PermissionMode { return mode }
export function setMode(m: PermissionMode) { mode = m; savePermissions() }

export function getRules() { return rules }

export function addRule(label: string, pattern: string, scope: PermissionScope) {
  rules.push({ label, pattern: new RegExp(pattern, 'i'), scope })
  savePermissions()
}

export function removeRule(index: number) {
  rules.splice(index, 1)
  savePermissions()
}

export function checkPermission(action: string): PermissionScope {
  if (mode === 'autopilot') return 'allow'
  if (mode === 'review-everything') return 'ask'
  for (const rule of rules) {
    if (rule.pattern.test(action)) return rule.scope
  }
  return 'ask'
}

export const DEFAULT_RULES = [
  { label: 'Git operations', pattern: '^git (push|pull|commit|status|log|diff)', scope: 'allow' as PermissionScope },
  { label: 'File read', pattern: '^(read|cat|ls|find|grep)', scope: 'allow' as PermissionScope },
  { label: 'File write/edit', pattern: '^(write|edit|sed|echo.>|Set-Content)', scope: 'ask' as PermissionScope },
  { label: 'Destructive', pattern: '^(git push --force|rm -rf|Remove-Item.*-Recurse|drop|delete)', scope: 'deny' as PermissionScope },
]
