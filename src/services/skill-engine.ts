import { emit, Events } from '@/services/event-bus'
import { addMemory, recall } from '@/services/memory'

interface Skill {
  id: string
  name: string
  description: string
  category: string
  prompt: string
  tools: string[]
  version: number
  author: 'system' | 'user' | 'agent'
  usageCount: number
  successRate: number
  createdAt: string
  updatedAt: string
}

interface SkillExecution {
  skillId: string
  input: string
  output: string
  success: boolean
  duration: number
  timestamp: string
}

const SKILL_KEY = 'ac_skills'

function loadAll(): Skill[] {
  if (typeof window === 'undefined') return []
  try {
    return JSON.parse(localStorage.getItem(SKILL_KEY) || '[]')
  } catch { return [] }
}

function saveAll(skills: Skill[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(SKILL_KEY, JSON.stringify(skills))
}

function generateId(): string {
  return `skill_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
}

export const BUILT_IN_SKILLS: Skill[] = [
  {
    id: 'code-review',
    name: 'Code Review',
    description: 'Review code for bugs, security issues, style problems, and improvements',
    category: 'development',
    prompt: 'Review the following code. Check for: 1) Bugs and logic errors 2) Security vulnerabilities 3) Performance issues 4) Style and best practices 5) Edge cases. Rate it 1-10 and list specific issues.',
    tools: ['read', 'grep'],
    version: 1, author: 'system', usageCount: 0, successRate: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'refactor',
    name: 'Refactor Code',
    description: 'Safely restructure and improve code without changing behavior',
    category: 'development',
    prompt: 'Refactor the following code: 1) Identify code smells 2) Apply appropriate design patterns 3) Improve readability 4) Add error handling 5) Keep the same API/behavior. Explain each change.',
    tools: ['edit', 'write', 'read'],
    version: 1, author: 'system', usageCount: 0, successRate: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'debug',
    name: 'Debug Error',
    description: 'Analyze error messages and stack traces to find root causes',
    category: 'development',
    prompt: 'Analyze this error/stack trace. 1) What caused it? 2) What is the root condition? 3) How to reproduce? 4) How to fix? 5) How to prevent it in the future?',
    tools: ['read', 'grep', 'shell'],
    version: 1, author: 'system', usageCount: 0, successRate: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'explain',
    name: 'Explain Code',
    description: 'Explain what a piece of code does in plain language',
    category: 'documentation',
    prompt: 'Explain the following code: 1) High-level purpose 2) How it works step by step 3) Key design decisions 4) Assumptions and dependencies 5) Potential improvements.',
    tools: ['read'],
    version: 1, author: 'system', usageCount: 0, successRate: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'test-generator',
    name: 'Generate Tests',
    description: 'Generate unit tests for existing code',
    category: 'testing',
    prompt: 'Generate comprehensive tests for the following code. Include: 1) Happy path tests 2) Edge cases 3) Error handling 4) Integration tests where relevant. Use the project\'s existing test framework.',
    tools: ['read', 'write', 'shell'],
    version: 1, author: 'system', usageCount: 0, successRate: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'summarize',
    name: 'Summarize',
    description: 'Summarize long text, articles, or conversations into key points',
    category: 'utility',
    prompt: 'Summarize the following: 1) One-sentence summary 2) Key points (bullet list) 3) Main takeaway. Be concise and preserve important details.',
    tools: [],
    version: 1, author: 'system', usageCount: 0, successRate: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'document',
    name: 'Document Code',
    description: 'Add comprehensive documentation and JSDoc comments to code',
    category: 'documentation',
    prompt: 'Add documentation to the following code. Include: 1) File/module-level description 2) Function descriptions with params/returns 3) Type documentation 4) Usage examples for public APIs. Follow JSDoc/TSDoc conventions.',
    tools: ['edit', 'read'],
    version: 1, author: 'system', usageCount: 0, successRate: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'security-audit',
    name: 'Security Audit',
    description: 'Audit code for security vulnerabilities and OWASP Top 10 issues',
    category: 'security',
    prompt: 'Security audit this code. Check for: 1) Injection flaws (SQL, XSS, command) 2) Broken auth 3) Sensitive data exposure 4) XXE 5) Broken access control 6) Security misconfiguration 7) Insecure deserialization 8) Known vulnerable components 9) Insufficient logging. Rate overall security 1-10.',
    tools: ['read', 'grep', 'web_search'],
    version: 1, author: 'system', usageCount: 0, successRate: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'performance',
    name: 'Performance Analysis',
    description: 'Analyze code for performance bottlenecks and optimization opportunities',
    category: 'development',
    prompt: 'Analyze this code for performance: 1) Time complexity bottlenecks 2) Memory issues 3) Unnecessary operations 4) Caching opportunities 5) Async/parallelization potential. Suggest specific optimizations with before/after examples.',
    tools: ['read', 'grep'],
    version: 1, author: 'system', usageCount: 0, successRate: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'web-research',
    name: 'Web Research',
    description: 'Research a topic by searching the web and compiling findings',
    category: 'research',
    prompt: 'Research the following topic: 1) Search for current information 2) Read relevant sources 3) Compile key findings 4) Note any controversies or disagreements 5) Provide a balanced conclusion with citations.',
    tools: ['web_search', 'web_fetch'],
    version: 1, author: 'system', usageCount: 0, successRate: 1, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
]

export function getSkills(): Skill[] {
  return [...BUILT_IN_SKILLS, ...loadAll()]
}

export function getSkill(id: string): Skill | undefined {
  return getSkills().find(s => s.id === id)
}

export function getSkillsByCategory(category: string): Skill[] {
  return getSkills().filter(s => s.category === category)
}

export function createSkill(skill: Omit<Skill, 'id' | 'version' | 'usageCount' | 'successRate' | 'createdAt' | 'updatedAt'>): Skill {
  const existing = loadAll()
  const newSkill: Skill = {
    ...skill,
    id: generateId(),
    version: 1,
    usageCount: 0,
    successRate: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
  existing.push(newSkill)
  saveAll(existing)
  emit(Events.SKILL_CREATED, { skillId: newSkill.id, name: newSkill.name })
  return newSkill
}

export function improveSkill(id: string, executionResult: SkillExecution): Skill | null {
  const skills = loadAll()
  const idx = skills.findIndex(s => s.id === id)
  if (idx < 0) {
    const builtIn = BUILT_IN_SKILLS.find(s => s.id === id)
    if (!builtIn) return null
    const improved = { ...builtIn, ...executionResult, version: 2 }
    skills.push(improved)
    saveAll(skills)
    emit(Events.SKILL_IMPROVED, { skillId: id, version: 2 })
    return improved
  }

  const skill = skills[idx]
  skill.usageCount++
  skill.successRate = (skill.successRate * (skill.usageCount - 1) + (executionResult.success ? 1 : 0)) / skill.usageCount
  skill.updatedAt = new Date().toISOString()
  skills[idx] = skill
  saveAll(skills)
  emit(Events.SKILL_IMPROVED, { skillId: id, usageCount: skill.usageCount, successRate: skill.successRate })
  return skill
}

export function autoCreateSkill(
  userId: string,
  taskDescription: string,
  prompt: string,
  tools: string[],
  category: string = 'custom'
): Skill {
  const name = taskDescription.length > 40
    ? taskDescription.slice(0, 40) + '...'
    : taskDescription

  return createSkill({
    name,
    description: taskDescription,
    category,
    prompt,
    tools,
    author: 'agent',
  })
}

export function searchSkills(query: string): Skill[] {
  const all = getSkills()
  const lower = query.toLowerCase()
  return all.filter(s =>
    s.name.toLowerCase().includes(lower) ||
    s.description.toLowerCase().includes(lower) ||
    s.category.toLowerCase().includes(lower) ||
    s.prompt.toLowerCase().includes(lower)
  )
}

export function deleteSkill(id: string): boolean {
  const skills = loadAll()
  const idx = skills.findIndex(s => s.id === id)
  if (idx < 0) return false
  skills.splice(idx, 1)
  saveAll(skills)
  return true
}

export function getSkillStats(): { total: number; builtIn: number; custom: number; byCategory: Record<string, number> } {
  const all = getSkills()
  const byCategory: Record<string, number> = {}
  for (const s of all) {
    byCategory[s.category] = (byCategory[s.category] || 0) + 1
  }
  return {
    total: all.length,
    builtIn: BUILT_IN_SKILLS.length,
    custom: all.length - BUILT_IN_SKILLS.length,
    byCategory,
  }
}
