import { NextRequest, NextResponse } from 'next/server'
import { ok, fail, serverError } from '@/lib/api-utils'
import fs from 'fs'
import path from 'path'

const MAX_DEPTH = 5
const MAX_ENTRIES = 500
const HIDDEN_PATTERNS = /(^|\/)\.(?!vscode|gitignore|env)/

interface FileNode {
  name: string
  path: string
  type: 'file' | 'directory'
  children?: FileNode[]
  size?: number
}

function shouldExclude(name: string): boolean {
  return name === 'node_modules' || name === '.next' || name === '.git' || name === '.data' || name === '.aider'
    || name === 'build' || name === 'dist' || name === 'out' || name === '.turbo'
    || HIDDEN_PATTERNS.test(name)
}

function readTree(dir: string, depth: number): FileNode[] {
  if (depth > MAX_DEPTH) return []
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    const result: FileNode[] = []
    for (const entry of entries) {
      if (result.length >= MAX_ENTRIES) break
      if (shouldExclude(entry.name)) continue
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        const children = readTree(fullPath, depth + 1)
        result.push({ name: entry.name, path: fullPath, type: 'directory', children })
      } else if (entry.isFile()) {
        let size = 0
        try { size = fs.statSync(fullPath).size } catch { /* noop */ }
        result.push({ name: entry.name, path: fullPath, type: 'file', size })
      }
    }
    result.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    return result
  } catch {
    return []
  }
}

export async function POST(request: NextRequest) {
  try {
    const { dir } = await request.json()
    const rootDir = dir && typeof dir === 'string'
      ? path.resolve(dir)
      : process.cwd()

    if (!rootDir.startsWith(process.cwd()) && !rootDir.startsWith('/tmp')) {
      return fail('Access denied: can only browse project directory')
    }
    if (!fs.existsSync(rootDir)) return fail('Directory not found')
    if (!fs.statSync(rootDir).isDirectory()) return fail('Path is not a directory')

    const tree = readTree(rootDir, 0)
    return ok({
      root: rootDir,
      tree,
      total: tree.reduce((count, node) => count + countNodes(node), 0),
    })
  } catch (e) { return serverError(e) }
}

function countNodes(node: FileNode): number {
  let count = 1
  if (node.children) {
    for (const child of node.children) count += countNodes(child)
  }
  return count
}
