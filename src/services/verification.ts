import { selfCheck } from '@/services/self-check'
import type { Intent } from '@/services/intent-classifier'
import type { ResponseLength } from '@/services/format-matcher'

export interface VerificationRequest {
  response: string
  originalRequest: string
  sourceData?: string[]
  intent?: Intent
  expectedLength?: ResponseLength
  toolResults?: string[]
}

export interface VerificationIssue {
  type: 'unmatched-request' | 'unverified-claim' | 'wrong-format' | 'code-syntax' | 'missing-data' | 'wrong-length'
  detail: string
  severity: 'low' | 'medium' | 'high'
}

export interface VerificationResult {
  passed: boolean
  issues: VerificationIssue[]
  score: number
  suggestion?: string
}

function checkMatchesRequest(response: string, request: string): VerificationIssue[] {
  const issues: VerificationIssue[] = []
  const reqLower = request.toLowerCase()

  const explicitRequests = reqLower.match(/\b(?:write|create|make|build|show|explain|tell|list|find|search)\s+(?:(?:a|an|the)\s+)?(\w+(?:\s+\w+){0,3})/gi)
  if (explicitRequests) {
    for (const req of explicitRequests) {
      const keywords = req.toLowerCase().split(/\s+/).filter(w => !['write', 'create', 'make', 'build', 'show', 'explain', 'tell', 'list', 'find', 'search', 'a', 'an', 'the'].includes(w))
      const missing = keywords.filter(k => !response.toLowerCase().includes(k))
      if (missing.length === keywords.length) {
        issues.push({
          type: 'unmatched-request',
          detail: `Response may not address the request "${req}" — none of its keywords appear in the response`,
          severity: 'high',
        })
      }
    }
  }

  return issues
}

function checkFormat(response: string, expectedLength?: ResponseLength): VerificationIssue[] {
  const issues: VerificationIssue[] = []
  if (!expectedLength) return issues

  const wordCount = response.split(/\s+/).length
  if (expectedLength === 'short' && wordCount > 100) {
    issues.push({
      type: 'wrong-length',
      detail: `Expected short response (~3 sentences, ~50 words) but got ${wordCount} words`,
      severity: 'medium',
    })
  } else if (expectedLength === 'long' && wordCount < 50) {
    issues.push({
      type: 'wrong-length',
      detail: `Expected detailed response but only got ${wordCount} words`,
      severity: 'low',
    })
  }

  if (expectedLength === 'short' && response.includes('##')) {
    issues.push({
      type: 'wrong-format',
      detail: 'Short response should not use headings',
      severity: 'low',
    })
  }

  return issues
}

function checkMissingSource(response: string, toolResults: string[]): VerificationIssue[] {
  if (toolResults.length === 0) return []
  const issues: VerificationIssue[] = []

  const numbers = response.match(/\b(\d{2,}(?:[.,]\d+)?)\s*(?:%|k|K|million|billion)\b/g)
  if (numbers) {
    const sourceData = toolResults.join(' ')
    for (const num of numbers) {
      if (!sourceData.includes(num)) {
        issues.push({
          type: 'unverified-claim',
          detail: `Number "${num}" in response not found in any tool result`,
          severity: 'medium',
        })
      }
    }
  }

  return issues
}

export async function verify(config: VerificationRequest): Promise<VerificationResult> {
  const issues: VerificationIssue[] = []

  if (!config.response || config.response.trim().length === 0) {
    return { passed: false, issues: [{ type: 'missing-data', detail: 'Empty response', severity: 'high' }], score: 0, suggestion: 'Generate a non-empty response' }
  }

  issues.push(...checkMatchesRequest(config.response, config.originalRequest))

  if (config.toolResults && config.toolResults.length > 0) {
    issues.push(...checkMissingSource(config.response, config.toolResults))
  }

  if (config.expectedLength) {
    issues.push(...checkFormat(config.response, config.expectedLength))
  }

  const selfCheckResult = selfCheck(config.response, config.sourceData)
  for (const w of selfCheckResult.warnings) {
    issues.push({
      type: w.type === 'code-syntax-error' ? 'code-syntax' :
            w.type === 'unverified-url' ? 'unverified-claim' :
            w.type === 'suspicious-number' ? 'unverified-claim' :
            w.type === 'unsupported-language' ? 'wrong-format' :
            'unverified-claim',
      detail: w.detail,
      severity: w.severity === 'high' ? 'high' : w.severity === 'medium' ? 'medium' : 'low',
    })
  }

  let score = 1.0
  for (const issue of issues) {
    score -= issue.severity === 'high' ? 0.25 : issue.severity === 'medium' ? 0.1 : 0.03
  }
  score = Math.max(0, Math.round(score * 100) / 100)

  const highIssues = issues.filter(i => i.severity === 'high')
  const suggestion = highIssues.length > 0
    ? `Response has ${highIssues.length} high-severity issue(s). ${highIssues.map(i => i.detail).join('; ')}`
    : score < 0.7
      ? 'Response has minor issues. Consider reviewing before sending.'
      : undefined

  return { passed: highIssues.length === 0, issues, score, suggestion }
}
