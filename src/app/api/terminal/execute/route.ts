import { NextRequest, NextResponse } from 'next/server'
import { ok, fail, serverError } from '@/lib/api-utils'

const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\//i, /rm\s+-rf\s+\*$/i, /rm\s+-rf\s+\/\*/i,
  /format\s+\w+:?/i, /dd\s+if=/i, /:\(\)\s*\{/i,
  /sudo\s+rm/i, /git\s+push\s+--force/i,
  /DROP\s+TABLE/i, /TRUNCATE\s+TABLE/i,
  /Remove-Item\s+-Recurse/i, /Start-Process/i,
]

export async function POST(request: NextRequest) {
  try {
    const { command, workdir } = await request.json()
    if (!command || typeof command !== 'string') return fail('command is required')
    if (command.length > 5000) return fail('Command too long (max 5000 chars)')

    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(command)) {
        return fail(`Command blocked by safety rules`)
      }
    }

    const { exec } = await import('child_process')
    const util = await import('util')
    const execPromise = util.promisify(exec)
    const cwd = workdir || process.cwd()
    const { stdout, stderr } = await execPromise(command, { cwd, timeout: 30000 })
    let output = ''
    if (stdout) output += stdout
    if (stderr) output += stderr
    if (!output.trim()) output = '(no output)'
    const maxChars = 20000
    if (output.length > maxChars) output = output.slice(0, maxChars) + '\n\n... [truncated]'
    return ok({ command, output, exitCode: 0, cwd })
  } catch (err: any) {
    let output = `Error: ${err.message || 'Execution failed'}`
    if (err.stdout) output += `\n${err.stdout}`
    if (err.stderr) output += `\n${err.stderr}`
    return ok({ command: '', output: output.slice(0, 20000), exitCode: err.code || 1, cwd: '' })
  }
}
