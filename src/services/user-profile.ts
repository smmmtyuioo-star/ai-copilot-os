import { getSupabase } from '@/database/client'
import { localStore, hasSupabase } from '@/lib/storage'
import { generateId } from '@/lib/utils'

export interface UserProfile {
  techStack: string[]
  preferences: Record<string, string>
  pastDecisions: { topic: string; decision: string; timestamp: string }[]
}

const EXTRACTION_PATTERNS: { pattern: RegExp; key: string; extract: (match: RegExpMatchArray) => string }[] = [
  { pattern: /\bI\s+(use|work with|code in|write)\s+(javascript|typescript|python|rust|go|ruby|php|java|swift|kotlin)\b/i, key: 'language', extract: (m) => m[2].toLowerCase() },
  { pattern: /\bI\s+(use|work with|prefer)\s+(react|vue|angular|svelte|next\.?js|nuxt|express|django|flask|fastapi|rails|spring)\b/i, key: 'framework', extract: (m) => m[2].toLowerCase().replace(/\./g, '') },
  { pattern: /\bmy\s+(preferred\s+)?(editor|ide|code editor)\s+(is|:)\s+(\w+)/i, key: 'editor', extract: (m) => m[4].toLowerCase() },
  { pattern: /\bI\s+(use|prefer|like)\s+(postgres(ql)?|mysql|sqlite|mongodb|redis|supabase|firebase)\b/i, key: 'database', extract: (m) => m[2].toLowerCase().replace(/ql$/, '') },
  { pattern: /\b(deploy|host|ship)\s+(to|on|with)\s+(vercel|netlify|aws|gcp|azure|railway|heroku|docker)\b/i, key: 'deployTarget', extract: (m) => m[3].toLowerCase() },
  { pattern: /\bI\s+(use|prefer|like)\s+(tailwind|bootstrap|styled-components|css modules|sass|scss)\b/i, key: 'cssFramework', extract: (m) => m[2].toLowerCase() },
]

const PAST_DECISION_PATTERNS: { trigger: RegExp; topic: (m: RegExpMatchArray) => string; decision: (m: RegExpMatchArray) => string }[] = [
  { trigger: /\b(?:let'?s|we'?ll|I'?ll|going to)\s+(use|go with|stick with|try)\s+(\w+)/i, topic: (m) => `tool-choice:${m[2].toLowerCase()}`, decision: (m) => `Use ${m[2]}` },
  { trigger: /\b(don'?t|not|avoid|skip)\s+(use|need|want)\s+(\w+)/i, topic: (m) => `rejected:${m[3].toLowerCase()}`, decision: (m) => `Avoid ${m[3]}` },
]

function extractPreferences(message: string): { key: string; value: string }[] {
  const results: { key: string; value: string }[] = []
  for (const entry of EXTRACTION_PATTERNS) {
    const match = message.match(entry.pattern)
    if (match) {
      results.push({ key: entry.key, value: entry.extract(match) })
    }
  }
  return results
}

function extractDecisions(message: string, userId: string): { topic: string; decision: string }[] {
  const results: { topic: string; decision: string }[] = []
  for (const entry of PAST_DECISION_PATTERNS) {
    const match = message.match(entry.trigger)
    if (match) {
      results.push({ topic: entry.topic(match), decision: entry.decision(match) })
    }
  }
  return results
}

export function getLearnedProfile(userId: string): UserProfile {
  const profile: UserProfile = { techStack: [], preferences: {}, pastDecisions: [] }
  const items = localStore.profile.items.filter(i => i.id.startsWith(`${userId}_`))

  for (const item of items) {
    if (item.key === 'tech-stack') {
      profile.techStack = JSON.parse(item.value)
    } else if (item.key.startsWith('pref:')) {
      profile.preferences[item.key.slice(5)] = item.value
    } else if (item.key.startsWith('decision:')) {
      profile.pastDecisions.push({
        topic: item.key.slice(9),
        decision: item.value,
        timestamp: item.updatedAt,
      })
    }
  }

  return profile
}

export function learnFromMessage(message: string, userId: string): { learned: number; newPrefs: string[] } {
  let learned = 0
  const newPrefs: string[] = []

  if (!userId || !message) return { learned: 0, newPrefs: [] }

  const prefs = extractPreferences(message)
  for (const pref of prefs) {
    const existing = localStore.profile.items.find(i =>
      i.id === `${userId}_pref:${pref.key}`
    )
    if (existing) {
      if (existing.value !== pref.value) {
        localStore.profile.update(existing.id, { value: pref.value, updatedAt: new Date().toISOString() })
      }
    } else {
      localStore.profile.add({
        id: `${userId}_pref:${pref.key}`,
        key: `pref:${pref.key}`,
        value: pref.value,
        updatedAt: new Date().toISOString(),
      })
      newPrefs.push(pref.key)
      learned++
    }

    if (pref.key === 'language' || pref.key === 'framework') {
      const stack = getLearnedProfile(userId).techStack
      if (!stack.includes(pref.value)) {
        stack.push(pref.value)
        const existing = localStore.profile.items.find(i =>
          i.id === `${userId}_tech-stack`
        )
        if (existing) {
          localStore.profile.update(existing.id, { value: JSON.stringify(stack), updatedAt: new Date().toISOString() })
        } else {
          localStore.profile.add({
            id: `${userId}_tech-stack`,
            key: 'tech-stack',
            value: JSON.stringify(stack),
            updatedAt: new Date().toISOString(),
          })
        }
      }
    }
  }

  const decisions = extractDecisions(message, userId)
  for (const dec of decisions) {
    const existing = localStore.profile.items.find(i =>
      i.id === `${userId}_decision:${dec.topic}`
    )
    if (!existing) {
      localStore.profile.add({
        id: `${userId}_decision:${dec.topic}`,
        key: `decision:${dec.topic}`,
        value: dec.decision,
        updatedAt: new Date().toISOString(),
      })
      learned++
    }
  }

  return { learned, newPrefs }
}

export function getProfileContext(userId: string): string {
  const profile = getLearnedProfile(userId)
  const parts: string[] = []

  if (profile.techStack.length > 0) {
    parts.push(`Known tech stack: ${profile.techStack.join(', ')}`)
  }

  const prefs = Object.entries(profile.preferences)
  if (prefs.length > 0) {
    parts.push(`Preferences: ${prefs.map(([k, v]) => `${k}=${v}`).join(', ')}`)
  }

  if (profile.pastDecisions.length > 0) {
    const recent = profile.pastDecisions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 5)
    parts.push(`Recent decisions: ${recent.map(d => `${d.topic}: ${d.decision}`).join(' | ')}`)
  }

  return parts.length > 0 ? parts.join('\n') : ''
}

export function clearProfile(userId: string): void {
  const toRemove = localStore.profile.items.filter(i => i.id.startsWith(`${userId}_`))
  for (const item of toRemove) {
    localStore.profile.remove(item.id)
  }
}
