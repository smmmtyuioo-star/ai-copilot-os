import fs from 'fs/promises'
import path from 'path'
import os from 'os'

/**
 * Truncates a string to a maximum length.
 * If the string exceeds the max length, the full output is saved to a temporary file
 * and a reference to that file is appended to the truncated string.
 */
export async function safeTruncateOutput(output: string, maxLength: number = 20000, prefix: string = 'output'): Promise<string> {
  if (!output || output.length <= maxLength) {
    return output
  }

  const truncated = output.slice(0, maxLength)
  
  try {
    const tempDir = await fs.realpath(os.tmpdir())
    const tempFile = path.join(tempDir, `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}.txt`)
    await fs.writeFile(tempFile, output, 'utf8')
    return `${truncated}\n\n...output truncated...\nFull output saved to: ${tempFile}`
  } catch (err) {
    // Fallback if writing to temp file fails
    return `${truncated}\n\n...output truncated...`
  }
}
