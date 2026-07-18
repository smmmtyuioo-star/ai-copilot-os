export interface EditBlock {
  path: string
  search: string
  replace: string
}

export interface EditResult {
  success: boolean
  path: string
  error?: string
  didYouMean?: string
}

const HEAD = /^<{5,9} SEARCH>?\s*$/
const DIVIDER = /^={5,9}\s*$/
const UPDATED = /^>{5,9} REPLACE\s*$/

export function parseEditBlocks(content: string): EditBlock[] {
  const lines = content.split(/\r?\n/)
  const blocks: EditBlock[] = []
  let i = 0
  let currentFile = ''

  while (i < lines.length) {
    const line = lines[i]

    if (HEAD.test(line.trim())) {
      i++
      let searchLines: string[] = []
      let replaceLines: string[] = []
      let foundDivider = false
      let foundUpdated = false

      while (i < lines.length && !DIVIDER.test(lines[i].trim())) {
        searchLines.push(lines[i])
        i++
      }
      if (i < lines.length && DIVIDER.test(lines[i].trim())) {
        foundDivider = true
        i++
      }

      while (i < lines.length && !UPDATED.test(lines[i].trim())) {
        replaceLines.push(lines[i])
        i++
      }
      if (i < lines.length && UPDATED.test(lines[i].trim())) {
        foundUpdated = true
        i++
      }

      if (foundDivider && foundUpdated) {
        blocks.push({
          path: currentFile,
          search: searchLines.join('\n'),
          replace: replaceLines.join('\n'),
        })
      }
    } else if (line.includes('.') && !line.trim().startsWith('`') && !line.trim().startsWith('#')) {
      const fn = extractFilename(line)
      if (fn) currentFile = fn
      i++
    } else {
      i++
    }
  }

  return blocks
}

function extractFilename(line: string): string | null {
  const cleaned = line.replace(/^[*`#\s]+/, '').replace(/[*`:\s]+$/, '').trim()
  if (!cleaned || cleaned === '...') return null
  if (cleaned.includes('.') || cleaned.includes('/') || cleaned.includes('\\')) {
    return cleaned
  }
  return null
}

export function doReplace(
  content: string,
  searchText: string,
  replaceText: string
): string | null {
  if (!content && !searchText.trim()) {
    return replaceText
  }

  if (!searchText.trim()) {
    return content + (content.endsWith('\n') ? '' : '\n') + replaceText
  }

  const exact = tryExactMatch(content, searchText, replaceText)
  if (exact !== null) return exact

  const withLeadingWS = tryLeadingWhitespaceMatch(content, searchText, replaceText)
  if (withLeadingWS !== null) return withLeadingWS

  const withDots = tryDotDotDotMatch(content, searchText, replaceText)
  if (withDots !== null) return withDots

  return null
}

function tryExactMatch(content: string, search: string, replace: string): string | null {
  const idx = content.indexOf(search)
  if (idx >= 0) {
    return content.slice(0, idx) + replace + content.slice(idx + search.length)
  }

  const normContent = content.replace(/\r\n/g, '\n')
  const normSearch = search.replace(/\r\n/g, '\n')
  const normIdx = normContent.indexOf(normSearch)
  if (normIdx >= 0) {
    return normContent.slice(0, normIdx) + replace + normContent.slice(normIdx + normSearch.length)
  }

  return null
}

function tryLeadingWhitespaceMatch(content: string, search: string, replace: string): string | null {
  const searchLines = search.split('\n')
  const contentLines = content.split('\n')

  const searchIndent = Math.min(
    ...searchLines.filter(l => l.trim()).map(l => l.length - l.trimLeft().length)
  )
  if (!searchIndent || !isFinite(searchIndent)) return null

  const unindentedSearch = searchLines.map(l => l.slice(searchIndent)).join('\n')
  const unindentedReplace = replace.split('\n').map(l => l.slice(searchIndent)).join('\n')

  for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
    const chunk = contentLines.slice(i, i + searchLines.length)
    const chunkNormalized = chunk.map(l => l.trimStart()).join('\n')
    if (chunkNormalized === unindentedSearch) {
      const fileIndent = chunk[0].slice(0, chunk[0].length - chunk[0].trimStart().length)
      const adjustedReplace = unindentedReplace.split('\n').map(l => fileIndent + l).join('\n')
      const result = [
        ...contentLines.slice(0, i),
        ...adjustedReplace.split('\n'),
        ...contentLines.slice(i + searchLines.length),
      ].join('\n')
      return result
    }
  }

  return null
}

function tryDotDotDotMatch(content: string, search: string, replace: string): string | null {
  const dotsPattern = /^(\s*\.\.\.\s*)$/gm
  const searchParts = search.split(dotsPattern).filter(Boolean)
  const replaceParts = replace.split(dotsPattern).filter(Boolean)

  if (searchParts.length !== replaceParts.length) return null

  let result = content
  for (let pi = 0; pi < searchParts.length; pi++) {
    if (!searchParts[pi].trim()) continue
    if (searchParts[pi].trim() === '...') continue

    const idx = result.indexOf(searchParts[pi])
    if (idx < 0) return null
    if (result.indexOf(searchParts[pi], idx + 1) >= 0) return null

    result = result.slice(0, idx) + replaceParts[pi] + result.slice(idx + searchParts[pi].length)
  }

  return result
}

export function findSimilarLines(search: string, content: string, threshold: number = 0.6): string | null {
  const searchLines = search.split('\n').filter(l => l.trim())
  const contentLines = content.split('\n').filter(l => l.trim())

  if (searchLines.length === 0 || searchLines.length > contentLines.length) return null

  let bestRatio = 0
  let bestMatch: string[] = []

  for (let i = 0; i <= contentLines.length - searchLines.length; i++) {
    const chunk = contentLines.slice(i, i + searchLines.length)
    let matches = 0
    for (let j = 0; j < searchLines.length; j++) {
      if (chunk[j].trim() === searchLines[j].trim()) matches++
    }
    const ratio = matches / searchLines.length
    if (ratio > bestRatio) {
      bestRatio = ratio
      bestMatch = chunk
    }
  }

  if (bestRatio < threshold) return null
  return bestMatch.join('\n')
}

export function formatEditFailureMessage(
  blocks: EditBlock[],
  fileContents: Record<string, string>
): string {
  let msg = `# ${blocks.length} SEARCH/REPLACE block(s) failed to match!\n`

  for (const block of blocks) {
    const content = fileContents[block.path]
    msg += `\n## SearchReplaceNoExactMatch: Failed to match in ${block.path}\n`
    msg += `<<<<<<< SEARCH\n${block.search}\n=======\n${block.replace}\n>>>>>>> REPLACE\n\n`

    if (content) {
      const similar = findSimilarLines(block.search, content)
      if (similar) {
        msg += `Did you mean to match these lines from ${block.path}?\n\n\`\`\`\n${similar}\n\`\`\`\n\n`
      }
    }
  }

  msg += '\nThe SEARCH section must exactly match the existing file including all whitespace, comments, and indentation.'
  return msg
}
