export interface CheckWarning {
  type: 'unverified-claim' | 'suspicious-number' | 'unverified-url' | 'unsupported-language' | 'code-syntax-error'
  detail: string
  severity: 'low' | 'medium' | 'high'
}

export interface SelfCheckResult {
  passed: boolean
  warnings: CheckWarning[]
  score: number
  suggestion?: string
}

const URL_PATTERN = /https?:\/\/[^\s,;)]+/g
const NUMBER_PATTERN = /\b(\d{2,}(?:[.,]\d+)?)\s*(?:%|k|K|million|billion|users|people|dollars|USD)\b/g
const BACKTICK_PATTERN = /```(\w+)?\s*\n/g

function extractSourceContent(sources: string[]): string {
  return sources.join('\n\n')
}

function checkNumbersInSource(responseText: string, sourceContent: string): CheckWarning[] {
  const warnings: CheckWarning[] = []
  const numbers = responseText.match(NUMBER_PATTERN)
  if (!numbers) return warnings

  for (const num of numbers) {
    const normalized = num.toLowerCase()
    if (!sourceContent.toLowerCase().includes(normalized)) {
      const isSmall = parseInt(normalized) < 100
      if (!isSmall) {
        warnings.push({
          type: 'suspicious-number',
          detail: `Number "${num}" not found in source material`,
          severity: 'medium',
        })
      }
    }
  }
  return warnings
}

function checkUrlsInSource(responseText: string, sourceContent: string): CheckWarning[] {
  const warnings: CheckWarning[] = []
  const urls = responseText.match(URL_PATTERN)
  if (!urls) return warnings

  for (const url of urls) {
    if (!sourceContent.includes(url)) {
      warnings.push({
        type: 'unverified-url',
        detail: `URL "${url}" not found in source material`,
        severity: 'high',
      })
    }
  }
  return warnings
}

function checkCodeSyntax(responseText: string): CheckWarning[] {
  const warnings: CheckWarning[] = []
  const codeBlockRegex = /```(?:\w+)?\s*\n([\s\S]*?)```/g
  let match

  while ((match = codeBlockRegex.exec(responseText)) !== null) {
    const code = match[1]
    const lang = (match[0].match(BACKTICK_PATTERN)?.[1] || '').toLowerCase()

    if (lang === 'javascript' || lang === 'js' || lang === 'typescript' || lang === 'ts') {
      try {
        new Function(code)
      } catch (e) {
        if (code.includes('import ') || code.includes('export ')) continue
        warnings.push({
          type: 'code-syntax-error',
          detail: `${lang.toUpperCase()} code block contains syntax error: ${e instanceof Error ? e.message.slice(0, 80) : 'Unknown error'}`,
          severity: 'medium',
        })
      }
    }

    if (lang && !['javascript', 'js', 'typescript', 'ts', 'python', 'py', 'rust', 'rs', 'go', 'html', 'css', 'json', 'bash', 'sh', 'sql', 'yaml', 'yml', 'toml', 'markdown', 'text', 'plain'].includes(lang)) {
      warnings.push({
        type: 'unsupported-language',
        detail: `Code block labeled "${lang}" may not be valid syntax`,
        severity: 'low',
      })
    }
  }

  return warnings
}

function checkUnverifiedClaims(responseText: string): CheckWarning[] {
  const warnings: CheckWarning[] = []
  const claimPatterns = [
    /\b(the\s+)?(best|fastest|most\s+popular|leading|top-rated|highest)-/gi,
    /\b(according to|studies show|research indicates|experts say|it is known)\b/gi,
  ]

  for (const pattern of claimPatterns) {
    const matches = responseText.match(pattern)
    if (matches) {
      warnings.push({
        type: 'unverified-claim',
        detail: `Unverified claim: "${matches[0].trim()}" — verify against retrieved data`,
        severity: 'low',
      })
    }
  }

  return warnings
}

function calculateScore(warnings: CheckWarning[]): number {
  if (warnings.length === 0) return 1.0
  let deductions = 0
  for (const w of warnings) {
    deductions += w.severity === 'high' ? 0.3 : w.severity === 'medium' ? 0.15 : 0.05
  }
  return Math.max(0, Math.round((1.0 - deductions) * 100) / 100)
}

export function selfCheck(
  response: string,
  sourceData?: string[]
): SelfCheckResult {
  if (!response || response.trim().length === 0) {
    return { passed: true, warnings: [], score: 1.0 }
  }

  const warnings: CheckWarning[] = []
  const sourceContent = sourceData ? extractSourceContent(sourceData) : ''

  if (sourceContent) {
    warnings.push(...checkNumbersInSource(response, sourceContent))
    warnings.push(...checkUrlsInSource(response, sourceContent))
  }

  warnings.push(...checkCodeSyntax(response))
  warnings.push(...checkUnverifiedClaims(response))

  const score = calculateScore(warnings)
  const highWarnings = warnings.filter(w => w.severity === 'high')

  const suggestion = highWarnings.length > 0
    ? 'Response contains unverifiable claims. Consider adding disclaimers or removing unverified statements.'
    : score < 0.7
      ? 'Response has some issues. Review flagged items before finalizing.'
      : undefined

  return {
    passed: highWarnings.length === 0,
    warnings,
    score,
    suggestion,
  }
}
