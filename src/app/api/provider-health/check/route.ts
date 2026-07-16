import { NextResponse } from 'next/server'
import { ProviderKeyStore } from '@/services/provider-health/store'
import { getProvider } from '@/services/provider-health/providers'
import '@/services/provider-health/app-integration'

export async function GET() {
  const store = new ProviderKeyStore()

  const keyMap: Record<string, string[]> = {
    groq: ['GROQ_API_KEY', 'GROQ_KEY'],
    cerebras: ['CEREBRAS_API_KEY', 'CEREBRAS_KEY'],
    mistral: ['MISTRAL_API_KEY', 'MISTRAL_KEY'],
    openrouter: ['OPENROUTER_API_KEY', 'OPENROUTER_KEY'],
    google: ['GOOGLE_API_KEY', 'GOOGLE_KEY', 'GEMINI_API_KEY'],
    nvidia: ['NVIDIA_API_KEY', 'NVIDIA_KEY'],
    'google-safebrowsing': ['GOOGLE_SAFE_BROWSING_API_KEY', 'GOOGLE_SAFE_BROWSING_KEY'],
    cloudflare: ['CLOUDFLARE_API_KEY', 'CLOUDFLARE_KEY'],
  }

  for (const [providerId, envNames] of Object.entries(keyMap)) {
    if (!getProvider(providerId)) continue
    for (const name of envNames) {
      const key = process.env[name] || process.env[`NEXT_PUBLIC_${name}`]
      if (key && key.length > 10 && !key.includes('your-') && !key.includes('<')) {
        store.addKey(providerId, key)
        break
      }
    }
  }

  const results = await store.checkAll()
  const records = store.listAll()
  const freeModels = store.getAvailableFreeModels()

  return NextResponse.json({
    records: records.map(r => ({
      providerId: r.providerId,
      keyFingerprint: r.keyFingerprint,
      status: r.status,
      lastError: r.lastError,
      availableFreeModels: r.availableFreeModels,
      lastCheckedAt: r.lastCheckedAt,
    })),
    freeModels,
    checkedAt: Date.now(),
  })
}
