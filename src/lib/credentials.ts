import { generateTOTP } from './totp'

const CREDS_KEY = 'ac_credentials'
const MEMORY_INDEX_KEY = 'ac_memory_index'

interface CredentialRecord {
  id: string
  password: string
  createdAt: string
  lastAccess: string
  label?: string
}

function getStoredCredentials(): CredentialRecord[] {
  try {
    return JSON.parse(localStorage.getItem(CREDS_KEY) || '[]')
  } catch { return [] }
}

function saveCredentials(creds: CredentialRecord[]) {
  localStorage.setItem(CREDS_KEY, JSON.stringify(creds))
}

function generateRandomSecret(): Uint8Array {
  const secret = new Uint8Array(20)
  crypto.getRandomValues(secret)
  return secret
}

export async function generateCredentials(label?: string): Promise<{ id: string; password: string; record: CredentialRecord }> {
  const existing = getStoredCredentials()
  const existingIds = new Set(existing.map(c => c.id))
  const secret = generateRandomSecret()
  const now = Math.floor(Date.now() / 1000)
  const counter = Math.floor(now / 30)

  let id = ''
  let password = ''
  let attempts = 0

  while (attempts < 100) {
    const trialId = await generateTOTP(secret, counter + attempts, 6)
    if (!existingIds.has(trialId)) {
      id = trialId
      password = await generateTOTP(secret, counter + attempts + 1000, 10)
      break
    }
    attempts++
  }

  if (!id) throw new Error('Could not generate unique credentials')

  const record: CredentialRecord = {
    id,
    password,
    createdAt: new Date().toISOString(),
    lastAccess: new Date().toISOString(),
    label,
  }

  existing.push(record)
  saveCredentials(existing)
  return { id, password, record }
}

export function verifyCredentials(id: string, password: string): CredentialRecord | null {
  const creds = getStoredCredentials()
  const match = creds.find(c => c.id === id && c.password === password)
  if (match) {
    match.lastAccess = new Date().toISOString()
    saveCredentials(creds)
  }
  return match || null
}

export function getCredentialById(id: string): CredentialRecord | null {
  return getStoredCredentials().find(c => c.id === id) || null
}

export function getAllCredentials(): CredentialRecord[] {
  return getStoredCredentials()
}

export function deleteCredential(id: string) {
  const creds = getStoredCredentials().filter(c => c.id !== id)
  saveCredentials(creds)
}

export function getActiveCredentialId(): string | null {
  try {
    const stored = localStorage.getItem('ac_active_credential')
    if (stored) return JSON.parse(stored).id || null
  } catch {}
  return null
}

export function getMemoryIndex(userId: string): string[] {
  try {
    const all = JSON.parse(localStorage.getItem(MEMORY_INDEX_KEY) || '{}')
    return all[userId] || []
  } catch { return [] }
}

export function addToMemoryIndex(userId: string, memoryId: string) {
  const all = JSON.parse(localStorage.getItem(MEMORY_INDEX_KEY) || '{}')
  if (!all[userId]) all[userId] = []
  if (!all[userId].includes(memoryId)) all[userId].push(memoryId)
  localStorage.setItem(MEMORY_INDEX_KEY, JSON.stringify(all))
}

export function removeFromMemoryIndex(userId: string, memoryId: string) {
  const all = JSON.parse(localStorage.getItem(MEMORY_INDEX_KEY) || '{}')
  if (all[userId]) {
    all[userId] = all[userId].filter((id: string) => id !== memoryId)
    localStorage.setItem(MEMORY_INDEX_KEY, JSON.stringify(all))
  }
}
