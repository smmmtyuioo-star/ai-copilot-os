interface SkillDefinition {
  id: string
  name: string
  description: string
  icon: string
  category: string
  systemPrompt: string
  inputLabel: string
  inputPlaceholder: string
  builtIn: boolean
  source?: 'manual' | 'auto-generated' | 'from-task'
  sourceTaskId?: string
  tags: string[]
  createdAt: string
  usageCount: number
}

interface SkillGenerationInput {
  taskDescription: string
  taskOutput: string
  sourceTaskId?: string
  suggestedName?: string
}

const STORAGE_KEY = 'ac_custom_skills'
const BUILT_IN_IDS = new Set([
  'docx', 'pdf', 'pptx', 'xlsx', 'file-reading',
  'frontend-design', 'product-knowledge', 'pdf-reading',
  'code-review', 'api-design',
])

class SkillRegistry {
  private skills: SkillDefinition[] = []
  private listeners: Set<() => void> = new Set()

  constructor() {
    this.load()
  }

  private load(): void {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      this.skills = raw ? JSON.parse(raw) : []
    } catch {
      this.skills = []
    }
  }

  private persist(): void {
    if (typeof window === 'undefined') return
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.skills))
    this.notify()
  }

  private notify(): void {
    for (const cb of this.listeners) cb()
  }

  register(input: SkillGenerationInput): SkillDefinition {
    const name = input.suggestedName || this.generateName(input.taskDescription)
    const skill: SkillDefinition = {
      id: `skill_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      description: this.generateDescription(input.taskDescription),
      icon: this.inferIcon(input.taskDescription),
      category: this.inferCategory(input.taskDescription),
      systemPrompt: this.generatePrompt(input.taskDescription, input.taskOutput),
      inputLabel: `What do you want to ${name}?`,
      inputPlaceholder: `Describe what ${name} should do...`,
      builtIn: false,
      source: 'auto-generated',
      sourceTaskId: input.sourceTaskId,
      tags: this.inferTags(input.taskDescription),
      createdAt: new Date().toISOString(),
      usageCount: 0,
    }
    this.skills.push(skill)
    this.persist()
    return skill
  }

  manualCreate(params: Omit<SkillDefinition, 'id' | 'builtIn' | 'usageCount' | 'createdAt' | 'source'>): SkillDefinition {
    const skill: SkillDefinition = {
      ...params,
      id: `skill_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      builtIn: false,
      source: 'manual',
      usageCount: 0,
      createdAt: new Date().toISOString(),
    }
    this.skills.push(skill)
    this.persist()
    return skill
  }

  getAll(): SkillDefinition[] {
    return [...this.skills]
  }

  getById(id: string): SkillDefinition | undefined {
    return this.skills.find(s => s.id === id)
  }

  getByCategory(category: string): SkillDefinition[] {
    return this.skills.filter(s => s.category === category)
  }

  getByTag(tag: string): SkillDefinition[] {
    return this.skills.filter(s => s.tags.includes(tag))
  }

  delete(id: string): boolean {
    if (BUILT_IN_IDS.has(id)) return false
    const idx = this.skills.findIndex(s => s.id === id)
    if (idx < 0) return false
    this.skills.splice(idx, 1)
    this.persist()
    return true
  }

  incrementUsage(id: string): void {
    const skill = this.skills.find(s => s.id === id)
    if (skill) { skill.usageCount++; this.persist() }
  }

  search(query: string): SkillDefinition[] {
    const q = query.toLowerCase()
    return this.skills.filter(s =>
      s.name.toLowerCase().includes(q) ||
      s.description.toLowerCase().includes(q) ||
      s.tags.some(t => t.toLowerCase().includes(q)) ||
      s.category.toLowerCase().includes(q)
    )
  }

  getCategories(): string[] {
    return [...new Set(this.skills.map(s => s.category))]
  }

  getPopular(limit = 5): SkillDefinition[] {
    return [...this.skills].sort((a, b) => b.usageCount - a.usageCount).slice(0, limit)
  }

  onChange(cb: () => void): () => void {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }

  private generateName(taskDescription: string): string {
    const cleaned = taskDescription
      .replace(/please|create|build|generate|make|write|implement|develop|design/gi, '')
      .trim()
    const words = cleaned.split(/\s+/).filter(w => w.length > 2).slice(0, 3)
    return words.length > 0
      ? words.map(w => w[0].toUpperCase() + w.slice(1)).join(' ')
      : 'Custom Skill'
  }

  private generateDescription(taskDescription: string): string {
    const maxLen = 100
    const desc = taskDescription.length > maxLen
      ? taskDescription.slice(0, maxLen).trimEnd() + '...'
      : taskDescription
    return desc
  }

  private generatePrompt(description: string, output: string): string {
    const sample = output.slice(0, 500)
    return `You are a specialized AI assistant for: ${description}

Follow this approach based on prior successful execution:

${sample}

---
When given a new task in this domain:
1. Analyze the request thoroughly
2. Apply the patterns shown above
3. Produce a complete, well-structured result
4. Verify your output matches quality standards

Be specific, practical, and actionable.`
  }

  private inferIcon(description: string): string {
    const lower = description.toLowerCase()
    if (lower.includes('code') || lower.includes('program') || lower.includes('script')) return '💻'
    if (lower.includes('doc') || lower.includes('report') || lower.includes('letter')) return '📝'
    if (lower.includes('design') || lower.includes('ui') || lower.includes('layout')) return '🎨'
    if (lower.includes('data') || lower.includes('analytics') || lower.includes('chart')) return '📊'
    if (lower.includes('api') || lower.includes('endpoint') || lower.includes('rest')) return '🔌'
    if (lower.includes('test') || lower.includes('qa') || lower.includes('quality')) return '🧪'
    if (lower.includes('secur') || lower.includes('vuln') || lower.includes('audit')) return '🔒'
    if (lower.includes('search') || lower.includes('find') || lower.includes('lookup')) return '🔍'
    if (lower.includes('email') || lower.includes('mail') || lower.includes('message')) return '✉️'
    return '⚡'
  }

  private inferCategory(description: string): string {
    const lower = description.toLowerCase()
    if (lower.includes('code') || lower.includes('program') || lower.includes('api') || lower.includes('test')) return 'Development'
    if (lower.includes('doc') || lower.includes('report') || lower.includes('letter') || lower.includes('word')) return 'Documents'
    if (lower.includes('design') || lower.includes('ui') || lower.includes('layout') || lower.includes('color')) return 'Design'
    if (lower.includes('data') || lower.includes('analytics') || lower.includes('chart') || lower.includes('excel')) return 'Data'
    if (lower.includes('review') || lower.includes('audit') || lower.includes('secur')) return 'Analysis'
    return 'Custom'
  }

  private inferTags(description: string): string[] {
    const tags: string[] = []
    const lower = description.toLowerCase()
    const tagMap: [RegExp, string][] = [
      [/typescript|javascript|ts|js/, 'TypeScript'],
      [/python|py/, 'Python'],
      [/react|nextjs|next/, 'React'],
      [/api|rest|graphql/, 'API'],
      [/database|sql|db/, 'Database'],
      [/docker|container|deploy/, 'DevOps'],
      [/test|jest|vitest|testing/, 'Testing'],
      [/security|vuln|audit/, 'Security'],
      [/data|analytics|pipeline/, 'Data'],
      [/ui|ux|design|frontend/, 'Frontend'],
      [/backend|server|service/, 'Backend'],
    ]
    for (const [pattern, tag] of tagMap) {
      if (pattern.test(lower) && !tags.includes(tag)) tags.push(tag)
    }
    return tags
  }
}

export const skillRegistry = new SkillRegistry()
