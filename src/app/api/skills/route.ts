import { NextRequest } from 'next/server'
import { ok, fail, serverError } from '@/lib/api-utils'
import { runAgentLoop } from '@/services/agent-loop'

export async function POST(request: NextRequest) {
  try {
    const { skillId, inputs } = await request.json()
    if (!skillId || !inputs) return fail('Skill ID and inputs are required')

    const SYSTEM_PROMPTS: Record<string, string> = {
      'code-review': 'Review the provided code for bugs, security, performance, and best practices. Be thorough.',
      'api-design': 'Design a complete API based on the description. Include endpoints, schemas, auth, errors.',
      'frontend-design': 'You are a senior frontend designer. Provide color palette, typography, layout, responsive behavior.',
      'translator': 'Translate the given text to the requested language. Preserve formatting and tone.',
      'summarizer': 'Summarize the given text into key points and main takeaway. Be concise.',
      'data-export': 'Generate a formatted JSON/CSV export of the requested data.',
      'regex-tester': 'Generate a regular expression for the described pattern. Explain how it works.',
      'note-taker': 'Save this note and format it with a title, date, and tags.',
      'docx': 'Generate a complete .docx document based on the description.',
      'pdf': 'Generate a structured PDF document plan.',
      'pptx': 'Generate a complete PowerPoint presentation outline.',
      'xlsx': 'Generate a spreadsheet plan with columns, formulas, and charts.',
    }

    const systemPrompt = SYSTEM_PROMPTS[skillId] || 'You are a helpful AI assistant. Complete the task based on the inputs provided.'

    const result = await runAgentLoop({
      messages: [{ role: 'user', content: typeof inputs === 'string' ? inputs : JSON.stringify(inputs) }],
      tools: ['execute_code'],
      maxTurns: 2,
      userId: 'api',
      systemPrompt,
    })

    if (!result.success) return fail(result.error || 'Skill execution failed')
    return ok({ output: result.content }, 'Skill executed')
  } catch (e) { return serverError(e) }
}
