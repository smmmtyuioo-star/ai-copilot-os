import { runAgentLoop } from '@/services/agent-loop'

export interface GameRequest {
  description: string
  type?: 'html' | 'canvas' | 'phaser' | 'three'
  userId?: string
}

export interface GameResult {
  success: boolean
  code: string
  language: string
  title: string
  description: string
  summary: string
  error?: string
}

const GAME_SYSTEM_PROMPT = `You are a game developer. Generate a complete, playable game in a single HTML file.

RULES:
- Output a SINGLE self-contained HTML file with embedded CSS and JavaScript.
- The game must be fully playable immediately — no external dependencies, no imports.
- Use Canvas API or DOM manipulation — nothing that requires a build step.
- Include a title, instructions, score display, and game-over/restart logic.
- Make the game fun, polished, and visually appealing with CSS styling.
- Fix any bugs — the code must work on first load.
- Output ONLY the complete HTML code wrapped in a markdown code block. No explanations before or after.

Examples: Snake, Pong, Breakout, Platformer, Memory Match, Tetris, Flappy Bird, Space Invaders, Clicker, Puzzle.`

export async function buildGame(request: GameRequest): Promise<GameResult> {
  try {
    const userMessage = `Build a complete, polished game: ${request.description}. Create a single HTML file with embedded CSS and JS. The game should be fully playable, fun, and visually polished. Include instructions, scoring, and restart.`
    const gameTypeHint = request.type ? ` Use ${request.type} for rendering.` : ''

    const result = await runAgentLoop({
      messages: [{ role: 'user', content: userMessage + gameTypeHint }],
      tools: ['execute_code'],
      maxTurns: 3,
      userId: request.userId || 'anonymous',
      systemPrompt: GAME_SYSTEM_PROMPT,
    })

    if (!result.success) {
      return { success: false, code: '', language: 'html', title: 'Error', description: request.description, summary: '', error: result.error || 'Failed to build game' }
    }

    const codeMatch = result.content.match(/```html\s*\n([\s\S]*?)```/)
    const code = codeMatch ? codeMatch[1].trim() : result.content

    const titleMatch = result.content.match(/<title>([^<]*)<\/title>/i)
    const title = titleMatch ? titleMatch[1].trim() : 'Game'

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
