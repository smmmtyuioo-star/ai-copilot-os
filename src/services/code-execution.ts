import vm from 'vm'
import { parseError } from '@/lib/utils'

export interface CodeExecutionConfig {
  code: string
  language: 'javascript' | 'typescript'
  timeout?: number
  maxOutputLength?: number
}

export interface CodeExecutionResult {
  success: boolean
  stdout: string
  stderr: string
  executionTimeMs: number
  error?: string
}

const DEFAULT_TIMEOUT = 5000
const MAX_TIMEOUT = 30000
const DEFAULT_MAX_OUTPUT = 10000

export async function executeCode(config: CodeExecutionConfig): Promise<CodeExecutionResult> {
  const { code, language, maxOutputLength = DEFAULT_MAX_OUTPUT } = config
  const timeout = Math.min(config.timeout || DEFAULT_TIMEOUT, MAX_TIMEOUT)

  if (!code || code.trim().length === 0) {
    return { success: false, stdout: '', stderr: 'No code provided', executionTimeMs: 0, error: 'No code provided' }
  }

  if (language === 'typescript') {
    return { success: false, stdout: '', stderr: '', executionTimeMs: 0, error: 'TypeScript execution requires transpilation. Use JavaScript or strip types first.' }
  }

  const startTime = Date.now()
  const stdoutChunks: string[] = []
  const stderrChunks: string[] = []

  const mockConsole = {
    log: (...args: unknown[]) => { stdoutChunks.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')) },
    error: (...args: unknown[]) => { stderrChunks.push(args.map(a => String(a)).join(' ')) },
    warn: (...args: unknown[]) => { stderrChunks.push(args.map(a => String(a)).join(' ')) },
    info: (...args: unknown[]) => { stdoutChunks.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ')) },
  }

  const sandbox = {
    console: mockConsole,
    Math, JSON, Date, RegExp, Map, Set, Promise,
    Int8Array, Uint8Array, Uint8ClampedArray,
    Int16Array, Uint16Array, Int32Array, Uint32Array,
    Float32Array, Float64Array, ArrayBuffer,
    Number, Boolean, String, Array, Object,
    Error, TypeError, RangeError, SyntaxError, ReferenceError,
    isNaN, isFinite, parseFloat, parseInt,
    decodeURI, decodeURIComponent, encodeURI, encodeURIComponent,
    Infinity, NaN, undefined,
    setTimeout: undefined, setInterval: undefined, setImmediate: undefined,
    require: undefined, process: undefined, global: undefined,
    Buffer: undefined, __dirname: undefined, __filename: undefined,
    module: undefined, exports: undefined, import: undefined,
  }

  try {
    const context = vm.createContext(sandbox)
    const script = new vm.Script(code)

    script.runInContext(context, { timeout, breakOnSigint: true })

    const executionTimeMs = Date.now() - startTime
    let stdout = stdoutChunks.join('\n')
    let stderr = stderrChunks.join('\n')
    if (stdout.length > maxOutputLength) stdout = stdout.slice(0, maxOutputLength) + '\n... [output truncated]'
    if (stderr.length > maxOutputLength) stderr = stderr.slice(0, maxOutputLength) + '\n... [output truncated]'

    return { success: true, stdout, stderr, executionTimeMs }
  } catch (err) {
    const executionTimeMs = Date.now() - startTime
    let stdout = stdoutChunks.join('\n')
    let stderr = stderrChunks.join('\n')
    if (stdout.length > maxOutputLength) stdout = stdout.slice(0, maxOutputLength) + '\n... [output truncated]'
    if (stderr.length > maxOutputLength) stderr = stderr.slice(0, maxOutputLength) + '\n... [output truncated]'
    return { success: false, stdout, stderr, executionTimeMs, error: parseError(err) }
  }
}
