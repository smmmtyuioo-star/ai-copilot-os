import { NextRequest } from 'next/server'
import { ok, fail, serverError } from '@/lib/api-utils'
import { runAgentLoop } from '@/services/agent-loop'

export async function POST(request: NextRequest) {
  try {
    const { skillId, inputs } = await request.json()
    if (!skillId || !inputs) return fail('Skill ID and inputs are required')

    const SYSTEM_PROMPTS: Record<string, string> = {
      'code-review': `You are a senior code reviewer. Analyze provided code for: (1) bugs and logic errors, (2) security vulnerabilities (XSS, injection, auth flaws), (3) performance bottlenecks, (4) adherence to best practices and patterns. Give each issue a severity (critical/major/minor) and a specific fix recommendation. Be thorough but constructive.`,
      'api-design': `You are a senior API architect. Design a complete REST/GraphQL API based on the description. Include: resource endpoints with methods, request/response schemas (JSON), authentication strategy, error handling patterns, rate limiting, pagination, versioning strategy. Use OpenAPI/Swagger-style descriptions.`,
      'frontend-design': `You are a senior frontend designer. Given a description, provide: curated color palette (hex with light/dark variants), typography system (font stack, scale, weights), spacing/layout system, component design patterns, responsive breakpoints, micro-interactions, accessibility considerations. Think "design system" not "one-off page".`,
      'translator': `Translate the given text to the requested language. Rules: preserve all formatting, tone, and nuance. Keep code blocks, URLs, and proper nouns unchanged. Output the translation only — no explanations or commentary. If the target language uses a different script, transliterate proper names.`,
      'summarizer': `Summarize the given text into structured output: (1) one-sentence TL;DR, (2) 3-5 key bullet points, (3) main takeaway. Be concise — favor precision over completeness. Preserve critical numbers, dates, and named entities. Output as clean markdown with no preamble.`,
      'data-export': `Generate a formatted data export of the requested information. Detect the optimal format (JSON for structured, CSV for tabular, markdown for readable). Include headers, proper escaping, and encoding. Validate the output is parseable. Output ONLY the data — no explanations.`,
      'regex-tester': `Generate a regular expression for the described pattern. For each regex, show: (1) the pattern with flags, (2) a plain-English explanation of what it matches, (3) examples of matches and non-matches, (4) edge cases. Test the regex in your reasoning before outputting.`,
      'note-taker': `Save this note with proper formatting: title (descriptive), date (ISO 8601), tags (3-5 relevant tags), content (preserve original formatting, link URLs, highlight key terms). Structure as clean markdown.`,
      'docx': `You are a document specialist. Generate a complete .docx-compatible document plan based on the description. Include: title page, table of contents, section structure with headings, body content outline, references/appendix. Use professional formatting standards (APA/MLA/business).`,
      'pdf': `You are a document designer. Generate a structured PDF document plan. Include: page layout (size, margins), typography system, section hierarchy, content blocks (text, tables, images, code), header/footer, page numbers. Describe how each element should render on the page.`,
      'pptx': `You are a presentation designer. Generate a complete PowerPoint presentation outline. Include: slide titles, speaker notes per slide, suggested visuals/charts, slide transitions, color theme. Structure for maximum audience engagement — clear narrative arc, minimal text per slide, impactful visuals.`,
      'xlsx': `You are a spreadsheet architect. Generate a spreadsheet plan with: sheet names and purposes, column definitions (name, type, format, validation), formulas and calculations, chart recommendations, conditional formatting rules. Think "production spreadsheet" not "quick scratchpad".`,
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
