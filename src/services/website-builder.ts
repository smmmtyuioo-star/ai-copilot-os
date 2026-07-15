import { runAgentLoop } from '@/services/agent-loop'

export interface WebsiteRequest {
  description: string
  type?: 'landing' | 'dashboard' | 'blog' | 'portfolio' | 'business' | 'custom'
  userId?: string
}

export interface WebsiteResult {
  success: boolean
  code: string
  language: string
  title: string
  description: string
  summary: string
  error?: string
}

const WEBSITE_SYSTEM_PROMPT = `You are a frontend web developer. Generate a complete, production-quality website in a single HTML file.

RULES:
- Output a SINGLE self-contained HTML file with embedded CSS and JavaScript.
- Use modern CSS (flexbox, grid, CSS variables, transitions, responsive design).
- Include polished UI with a color scheme, typography, spacing, and hover effects.
- Add interactivity with vanilla JS (no frameworks) — forms, animations, toggles, etc.
- Mobile-first responsive design — looks great on phone, tablet, and desktop.
- Include a navigation bar, hero/header, content sections, and a footer.
- Make it look like a professional, modern website — not a basic template.
- Output ONLY the complete HTML code wrapped in a markdown code block. No explanations before or after.

Examples: Landing pages, business sites, portfolios, blogs, SaaS product pages, documentation sites, event pages.`

export async function buildWebsite(request: WebsiteRequest): Promise<WebsiteResult> {
  try {
    const userMessage = `Build a complete, production-ready website: ${request.description}. Create a single HTML file with embedded CSS and JS. The website should be responsive, modern, visually polished, and include navigation, multiple sections, and interactive elements.`

    const result = await runAgentLoop({
      messages: [{ role: 'user', content: userMessage }],
      tools: ['execute_code'],
      maxTurns: 3,
      userId: request.userId || 'anonymous',
      systemPrompt: WEBSITE_SYSTEM_PROMPT,
    })

    if (!result.success) {
      return { success: false, code: '', language: 'html', title: 'Error', description: request.description, summary: '', error: result.error || 'Failed to build website' }
    }

    const codeMatch = result.content.match(/```html\s*\n([\s\S]*?)```/)
    const code = codeMatch ? codeMatch[1].trim() : result.content

    const titleMatch = result.content.match(/<title>([^<]*)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : 'Website'

    const summary = result.content.length > 200 ? result.content.slice(0, 200) + '...' : result.content

    return {
      success: true,
      code,
      language: 'html',
      title,
      description: request.description,
      summary,
    }
  } catch (err) {
    return { success: false, code: '', language: 'html', title: 'Error', description: request.description, summary: '', error: err instanceof Error ? err.message : 'Unknown error' }
  }
}
