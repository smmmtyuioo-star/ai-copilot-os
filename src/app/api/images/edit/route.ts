import { NextRequest, NextResponse } from 'next/server'
import { runAgentLoop } from '@/services/agent-loop'

export async function POST(request: NextRequest) {
  try {
    const { image, editInstruction } = await request.json()
    if (!image || !editInstruction) {
      return NextResponse.json({ error: 'image and editInstruction are required' }, { status: 400 })
    }

    const result = await runAgentLoop({
      messages: [{
        role: 'user',
        content: `I have an image/visual with this description/code: """${image.slice(0, 3000)}""" Edit it according to: "${editInstruction}". Generate a complete, self-contained HTML file with embedded CSS and SVG that shows the edited version. Output ONLY the complete HTML code.`,
      }],
      tools: ['execute_code'],
      maxTurns: 2,
      userId: 'image-edit',
      systemPrompt: `You are a visual editor AI. Given an existing HTML/SVG visualization and an edit instruction, modify the code to reflect the changes. Preserve the original style and quality. Output the complete modified HTML file.`,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Edit failed' }, { status: 500 })
    }

    const htmlMatch = result.content.match(/```html\s*\n([\s\S]*?)```/) || result.content.match(/<html[\s\S]*?<\/html>/i)
    const html = htmlMatch ? (htmlMatch[1] || htmlMatch[0]) : result.content

    return NextResponse.json({ success: true, html, editInstruction })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Image edit failed' },
      { status: 500 },
    )
  }
}
