import { NextRequest, NextResponse } from 'next/server'
import { ok, fail, serverError } from '@/lib/api-utils'
import sharp from 'sharp'

const MAX_BYTES = 20 * 1024 * 1024
const TEXT_PREVIEW_CHARS = 50_000

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any)
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(binary, 'binary').toString('base64')
  }
  return btoa(binary)
}

async function processPdf(bytes: Uint8Array): Promise<{ text: string; pages: number; metadata: any }> {
  let pdfParse: any
  try {
    const mod = await import('pdf-parse')
    pdfParse = mod.default || mod
  } catch (e) {
    return { text: '', pages: 0, metadata: { error: 'pdf-parse unavailable' } }
  }
  try {
    const data = await pdfParse(Buffer.from(bytes))
    return {
      text: (data.text || '').slice(0, TEXT_PREVIEW_CHARS),
      pages: data.numpages || 0,
      metadata: { title: data.info?.Title, author: data.info?.Author, subject: data.info?.Subject },
    }
  } catch (e) {
    return { text: '', pages: 0, metadata: { error: e instanceof Error ? e.message : 'parse failed' } }
  }
}

async function processImage(bytes: Uint8Array, mime: string): Promise<{ description: string; width?: number; height?: number; format?: string }> {
  try {
    const meta = await sharp(bytes).metadata()
    const stats = await sharp(bytes).stats()
    const channels = stats.channels.map((c: any) => c.mean.toFixed(0)).join(',')
    const dominant = stats.channels.length > 0
      ? stats.channels.reduce((sum: number, c: any) => sum + c.mean, 0) / stats.channels.length
      : 0
    const brightness = dominant < 64 ? 'dark' : dominant < 128 ? 'mid' : dominant < 192 ? 'bright' : 'very bright'
    return {
      description: `Image: ${meta.format} ${meta.width}x${meta.height}, ${brightness}, channels (${channels})`,
      width: meta.width,
      height: meta.height,
      format: meta.format,
    }
  } catch (e) {
    return { description: `Image (${mime}) preview not available: ${e instanceof Error ? e.message : 'unknown'}` }
  }
}

async function processDocx(bytes: Uint8Array): Promise<{ text: string }> {
  try {
    const text = Buffer.from(bytes).toString('utf8')
    const matches = text.match(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []
    const extracted = matches.map(m => m.replace(/<[^>]+>/g, '')).join(' ')
    return { text: extracted.slice(0, TEXT_PREVIEW_CHARS) }
  } catch {
    return { text: '' }
  }
}

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData()
    const file = form.get('file') as File | null
    if (!file) return fail('No file provided')

    const name = file.name || 'file'
    const type = file.type || ''
    const size = file.size || 0
    if (size === 0) return fail('Empty file')
    if (size > MAX_BYTES) return fail(`File too large. Max ${MAX_BYTES / 1024 / 1024}MB`)

    const ab = await file.arrayBuffer()
    const bytes = new Uint8Array(ab)
    const lower = name.toLowerCase()

    if (type.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg|avif|tiff?)$/i.test(lower)) {
      const image = await processImage(bytes, type)
      const base64 = type.includes('svg') ? null : bytesToBase64(bytes)
      return ok({
        kind: 'image',
        name,
        size,
        type,
        ...image,
        dataUrl: base64 ? `data:${type};base64,${base64}` : null,
      })
    }

    if (type === 'application/pdf' || lower.endsWith('.pdf')) {
      const pdf = await processPdf(bytes)
      return ok({ kind: 'pdf', name, size, type, ...pdf })
    }

    if (type.includes('word') || lower.endsWith('.docx')) {
      const docx = await processDocx(bytes)
      return ok({ kind: 'docx', name, size, type, ...docx })
    }

    if (type.startsWith('text/') || /\.(txt|md|csv|json|log|ts|tsx|js|jsx|py|go|rs|java|c|cpp|cs|sh|yaml|yml|toml|ini|env)$/i.test(lower)) {
      const text = Buffer.from(bytes).toString('utf8').slice(0, TEXT_PREVIEW_CHARS)
      return ok({ kind: 'text', name, size, type, text })
    }

    return ok({
      kind: 'binary',
      name,
      size,
      type,
      description: `Binary file (${type || 'unknown'}). Metadata only.`,
    })
  } catch (e) { return serverError(e) }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', maxBytes: MAX_BYTES })
}
