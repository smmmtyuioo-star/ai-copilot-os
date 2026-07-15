import { NextRequest } from 'next/server'
import { generateId } from '@/lib/utils'
import { ok, fail, serverError } from '@/lib/api-utils'
import { runAgentLoop } from '@/services/agent-loop'

const IMAGE_SYSTEM_PROMPT = `You are an AI that describes images in vivid detail and generates HTML/CSS/SVG visualizations.

Given a prompt, output TWO things:
1. A vivid description of the image (composition, colors, lighting, mood, style)
2. A complete HTML file with embedded CSS that visually represents the image using pure CSS/SVG/Canvas

Output ONLY a JSON object with keys: "description" (string) and "html" (string containing complete HTML code).`

export async function POST(request: NextRequest) {
  try {
    const { prompt, action } = await request.json()
    if (!prompt) return fail('Prompt is required')

    if (action === 'generate') {
      const result = await runAgentLoop({
        messages: [{ role: 'user', content: prompt }],
        tools: ['execute_code'],
        maxTurns: 2,
        userId: 'api',
        systemPrompt: IMAGE_SYSTEM_PROMPT,
      })

      if (!result.success) return fail(result.error || 'Image generation failed')

      let parsed
      try { parsed = JSON.parse(result.content) } catch {
        parsed = { description: result.content, html: '' }
      }

      return ok({
        id: generateId(),
        prompt,
        description: parsed.description || '',
        html: parsed.html || '',
        createdAt: new Date().toISOString(),
      }, 'Image generated')
    }

    if (action === 'edit') {
      const { html, editInstruction } = await request.json()
      if (!html || !editInstruction) return fail('HTML and edit instruction are required')
      return ok({ html: `<!-- Edited: ${editInstruction} -->\n${html}` }, 'Image updated')
    }

    return fail('Unknown action. Use "generate" or "edit".')
  } catch (e) { return serverError(e) }
}
