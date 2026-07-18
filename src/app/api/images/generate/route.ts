import { NextRequest, NextResponse } from 'next/server'
import { runAgentLoop } from '@/services/agent-loop'

export async function POST(request: NextRequest) {
  try {
    const { prompt, style } = await request.json()
    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
    }

    const styleHint = style ? ` Style: ${style}.` : ''

    const result = await runAgentLoop({
      messages: [{
        role: 'user',
        content: `Create a visual representation of: "${prompt}".${styleHint} Generate a complete, self-contained HTML file with embedded CSS and SVG that visually depicts this scene. Use modern design: gradients, animations, semantic colors. The HTML must render the image visually — this is not a text description, it's an actual visual rendering. Include a brief caption at the bottom. Output ONLY the complete HTML code.`,
      }],
      tools: ['execute_code'],
      maxTurns: 2,
      userId: 'image-gen',
      systemPrompt: `You are a visual artist AI that creates images as HTML/SVG. Generate self-contained HTML files with embedded CSS and SVG that render as visual images. Use: gradients, shapes, paths, animations, filters, shadows, and blending to create rich visuals. Mobile-responsive. Dark theme. No external dependencies.`,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Generation failed' }, { status: 500 })
    }

    const htmlMatch = result.content.match(/```html\s*\n([\s\S]*?)```/) || result.content.match(/<html[\s\S]*?<\/html>/i)
    const html = htmlMatch ? (htmlMatch[1] || htmlMatch[0]) : result.content

    return NextResponse.json({ success: true, html, prompt })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Image generation failed' },
      { status: 500 },
    )
  }
}
