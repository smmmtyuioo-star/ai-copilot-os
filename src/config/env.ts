export const env = {
  supabase: {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
  },
  ai: {
    omnirouteKey: process.env.OMNIROUTE_API_KEY || '',
    groqKey: process.env.GROQ_API_KEY || '',
    cerebrasKey: process.env.CEREBRAS_API_KEY || '',
    fireworksKey: process.env.FIREWORKS_API_KEY || '',
    deepseekKey: process.env.DEEPSEEK_API_KEY || '',
    mistralKey: process.env.MISTRAL_API_KEY || '',
    openrouterKey: process.env.OPENROUTER_API_KEY || '',
    googleSafeBrowsingKey: process.env.GOOGLE_SAFE_BROWSING_KEY || '',
    defaultProvider: process.env.NEXT_PUBLIC_DEFAULT_AI_PROVIDER || 'groq',
    defaultModel: process.env.NEXT_PUBLIC_DEFAULT_AI_MODEL || 'llama-3.3-70b-versatile',
    maxTokens: parseInt(process.env.NEXT_PUBLIC_AI_MAX_TOKENS || '4096'),
    temperature: parseFloat(process.env.NEXT_PUBLIC_AI_TEMPERATURE || '0.7'),
  },
  app: {
    name: 'AI Copilot OS',
    url: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    version: '0.1.0',
  },
  storage: {
    maxFileSize: parseInt(process.env.NEXT_PUBLIC_MAX_FILE_SIZE || '10485760'),
    allowedTypes: (process.env.NEXT_PUBLIC_ALLOWED_FILE_TYPES || 'image/*,application/pdf,.doc,.docx,.txt,.csv').split(','),
  },
} as const

export function validateEnv(): string[] {
  const missing: string[] = []
  if (!env.supabase.url) missing.push('NEXT_PUBLIC_SUPABASE_URL')
  if (!env.supabase.anonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY')
  if (!env.ai.omnirouteKey && !env.ai.groqKey) {
    missing.push('At least one AI provider key: OMNIROUTE_API_KEY or GROQ_API_KEY')
  }
  return missing
}