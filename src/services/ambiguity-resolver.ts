export interface Ambiguity {
  type: string
  detail: string
  impact: 'low' | 'medium' | 'high'
}

export interface Assumption {
  field: string
  value: string
}

export interface AmbiguityResolution {
  hasAmbiguity: boolean
  ambiguities: Ambiguity[]
  assumptions: Assumption[]
  clarifyingQuestion?: string
  needsClarification: boolean
  resolvedMessage: string
}

interface ResolutionContext {
  history?: { role: string; content: string }[]
  availableTools?: string[]
  defaultModel?: string
  defaultLanguage?: string
}

const LANGUAGE_KEYWORDS = [
  'javascript', 'typescript', 'python', 'rust', 'go', 'golang',
  'java', 'c#', 'csharp', 'c++', 'cpp', 'ruby', 'php', 'swift',
  'kotlin', 'scala', 'dart', 'elixir', 'haskell', 'lua',
]

const FRAMEWORK_KEYWORDS = [
  'react', 'vue', 'angular', 'next.js', 'nextjs', 'nuxt', 'svelte',
  'express', 'fastify', 'django', 'flask', 'fastapi', 'rails',
  'spring', 'asp.net', 'laravel', 'symfony',
]

const VAGUE_REFERENCE_PATTERNS = [
  /\bit\b/i, /\bthat\b/i, /\bthis\b/i, /\bthose\b/i, /\bthese\b/i,
  /\bthe (code|thing|stuff|one|same|above|below)\b/i,
  /\bas (mentioned|said|discussed|noted)\b/i,
]

const AMBIGUITY_PATTERNS: { type: string; pattern: RegExp; impact: 'low' | 'medium' | 'high'; detail: (m: RegExpMatchArray) => string }[] = [
  {
    type: 'missing-language',
    pattern: /\b(write|create|make|build|implement|code|fix|debug|refactor)\s+(a|an|the|this|that)\s+(function|class|component|script|program|app|module|api|endpoint|plugin|tool)\b(?!.*\b(using|with|in)\s+(javascript|typescript|python|rust|go|java|ruby|php|c#|swift|kotlin)\b)/i,
    impact: 'high',
    detail: () => 'No programming language specified for code generation',
  },
  {
    type: 'missing-framework',
    pattern: /\b(component|page|layout|hook|context|provider|middleware|plugin)\b(?!.*\b(in|for|using)\s+(react|vue|angular|next|nuxt|svelte)\b)/i,
    impact: 'high',
    detail: () => 'No framework specified for component',
  },
  {
    type: 'missing-file-path',
    pattern: /\b(save|write|update|create|add)\s+(this|the|that|a|an)\s+(file|code|script|config)\b(?!.*\b(as|to|at|in)\s+['"][^'"]+['"]\b)/i,
    impact: 'medium',
    detail: () => 'No file path specified for save/create',
  },
  {
    type: 'vague-reference',
    pattern: /^(fix|debug|review|check|look at|examine)\s+(it|that|this|the\s+code|the\s+thing)\s*$/i,
    impact: 'high',
    detail: () => 'Vague reference without specifying what to fix/review',
  },
  {
    type: 'missing-database',
    pattern: /\b(create|design|set up|build|model|schema)\s+(a|an|the)\s+(database|table|schema|collection)\b(?!.*\b(in|using|for)\s+(postgres|mysql|sqlite|mongodb|redis|supabase|prisma)\b)/i,
    impact: 'medium',
    detail: () => 'No database type specified',
  },
  {
    type: 'missing-deploy-target',
    pattern: /\b(deploy|host|publish|launch|ship)\s+(this|the|a|an|my)\s+(app|site|api|service|project)\b(?!.*\b(to|on|with|using)\s+(vercel|netlify|aws|gcp|azure|railway|heroku|docker)\b)/i,
    impact: 'medium',
    detail: () => 'No deployment target specified',
  },
  {
    type: 'unspecified-scale',
    pattern: /\b(make|build|create|design)\s+(an?\s+)?(app|api|system|platform|dashboard|website)\b.*\b(for|with|that)\b.{20,}(?!.*\b(mvp|prototype|production|enterprise|scalable|simple|basic)\b)/i,
    impact: 'low',
    detail: () => 'Scale/scope not specified (MVP vs production)',
  },
  {
    type: 'unspecified-output-format',
    pattern: /\b(show|display|output|return|give me|list)\b(?!.*\b(as|in|format)\s+(json|csv|text|html|markdown|table|list|chart)\b)/i,
    impact: 'low',
    detail: () => 'No output format specified',
  },
]

export function resolveAmbiguity(
  message: string,
  context?: ResolutionContext
): AmbiguityResolution {
  const ambiguities: Ambiguity[] = []
  const assumptions: Assumption[] = []
  let resolvedMessage = message

  for (const entry of AMBIGUITY_PATTERNS) {
    const match = message.match(entry.pattern)
    if (match) {
      ambiguities.push({
        type: entry.type,
        detail: entry.detail(match),
        impact: entry.impact,
      })
    }
  }

  if (ambiguities.length === 0 && !VAGUE_REFERENCE_PATTERNS.some(p => p.test(message))) {
    return { hasAmbiguity: false, ambiguities: [], assumptions: [], needsClarification: false, resolvedMessage: message }
  }

  const highImpact = ambiguities.filter(a => a.impact === 'high')
  const mediumImpact = ambiguities.filter(a => a.impact === 'medium')
  const lowImpact = ambiguities.filter(a => a.impact === 'low')

  if (highImpact.length > 0) {
    const needsQuestion = highImpact.some(a =>
      a.type === 'missing-language' || a.type === 'vague-reference'
    )

    if (needsQuestion) {
      const question = highImpact.find(a => a.type === 'missing-language')
        ? 'Which programming language would you like me to use?'
        : highImpact.find(a => a.type === 'vague-reference')
          ? 'Could you specify exactly what needs to be fixed or reviewed?'
          : `Could you clarify: ${highImpact[0].detail}?`

      return {
        hasAmbiguity: true,
        ambiguities,
        assumptions: [],
        clarifyingQuestion: question,
        needsClarification: true,
        resolvedMessage: message,
      }
    }

    for (const a of highImpact) {
      switch (a.type) {
        case 'missing-framework':
          assumptions.push({ field: 'framework', value: 'React' })
          resolvedMessage += '\n(using React)'
          break
        case 'missing-file-path':
          assumptions.push({ field: 'filePath', value: './output.ext' })
          resolvedMessage += '\n(saving to ./output.ext)'
          break
      }
    }
  }

  for (const a of mediumImpact) {
    switch (a.type) {
      case 'missing-database':
        assumptions.push({ field: 'database', value: 'PostgreSQL' })
        resolvedMessage += '\n(using PostgreSQL)'
        break
      case 'missing-deploy-target':
        assumptions.push({ field: 'deployTarget', value: 'Vercel' })
        resolvedMessage += '\n(deploying to Vercel)'
        break
    }
  }

  for (const a of lowImpact) {
    switch (a.type) {
      case 'unspecified-scale':
        assumptions.push({ field: 'scope', value: 'MVP' })
        resolvedMessage += '\n(building as MVP)'
        break
      case 'unspecified-output-format':
        assumptions.push({ field: 'outputFormat', value: 'markdown' })
        break
    }
  }

  if (VAGUE_REFERENCE_PATTERNS.some(p => p.test(message)) && !ambiguities.some(a => a.type === 'vague-reference')) {
    assumptions.push({ field: 'context', value: 'last message or current file' })
  }

  return {
    hasAmbiguity: true,
    ambiguities,
    assumptions,
    needsClarification: false,
    resolvedMessage,
  }
}
