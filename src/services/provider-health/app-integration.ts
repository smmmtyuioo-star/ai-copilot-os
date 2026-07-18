import { ProviderKeyStore, PROVIDERS, getProvider } from ".";
import type { ProviderConfig } from "./types";
import { localStore } from "@/lib/storage";

const extraProviders: ProviderConfig[] = [
  {
    id: "cerebras",
    name: "Cerebras",
    baseUrl: "https://api.cerebras.ai/v1",
    listModelsPath: "/models",
    authHeaders: (key) => ({ Authorization: `Bearer ${key}` }),
    parseModels: (body) => {
      const data = (body as any)?.data;
      if (!Array.isArray(data)) return [];
      return data.map((m: any) => ({ id: m.id, raw: m }));
    },
    isFreeModel: () => true,
  },
  {
    id: "cloudflare",
    name: "Cloudflare Workers AI",
    baseUrl: "https://api.cloudflare.com/client/v4/accounts/9e8b558c1a7d8d9d3bea6f88d268c49a/ai",
    listModelsPath: "/models/search",
    authHeaders: (key) => ({ Authorization: `Bearer ${key}` }),
    parseModels: (body) => {
      const result = (body as any)?.result;
      if (!Array.isArray(result)) return [];
      return result.map((m: any) => ({ id: m.id, raw: m }));
    },
    isFreeModel: () => true,
  },
];

for (const p of extraProviders) {
  const existing = PROVIDERS.findIndex((x: any) => x.id === p.id);
  if (existing >= 0) PROVIDERS[existing] = p;
  else (PROVIDERS as any[]).push(p);
}

let store: ProviderKeyStore | null = null;

export function getStore(): ProviderKeyStore {
  if (!store) store = new ProviderKeyStore();
  return store;
}

const PROVIDER_KEY_MAP: Record<string, string[]> = {
  groq: ["GROQ", "groq"],
  cerebras: ["CEREBRAS", "cerebras"],
  cloudflare: ["CLOUDFLARE", "cloudflare"],
  mistral: ["MISTRAL", "mistral"],
  openrouter: ["OPENROUTER", "openrouter"],
  google: ["GOOGLE", "google", "GEMINI", "GOOGLE_GEMINI"],
  openai: ["OPENAI", "openai"],
  together: ["TOGETHER", "together"],
  nvidia: ["NVIDIA", "nvidia"],
  "google-safebrowsing": ["GOOGLE_SAFE_BROWSING", "google_safebrowsing"],
};

export function loadKeysFromEnv(): void {
  const s = getStore();
  for (const [providerId, envNames] of Object.entries(PROVIDER_KEY_MAP)) {
    if (!getProvider(providerId)) continue;
    for (const name of envNames) {
      const candidates = [process.env[`${name}_API_KEY`], process.env[`${name}_KEY`], process.env[`${name}_API_TOKEN`]];
      for (const key of candidates) {
        if (key && key.length > 10 && !key.includes("your-") && !key.includes("<")) {
          s.addKey(providerId, key);
          break;
        }
      }
    }
  }
}

export function loadKeysFromApiCenter(): void {
  const s = getStore();
  const apiKeys = localStore.apiKeys.items;
  for (const entry of apiKeys) {
    const provider = entry.provider || detectProviderFromKey(entry.key);
    if (provider && getProvider(provider)) {
      s.addKey(provider, entry.key);
    }
  }
}

function detectProviderFromKey(key: string): string | null {
  if (key.startsWith("gsk_")) return "groq";
  if (key.startsWith("sk-or-")) return "openrouter";
  if (key.startsWith("cfut_")) return "cloudflare";
  if (key.startsWith("csk-")) return "cerebras";
  // AIza keys are shared across all Google APIs — can't distinguish Gemini vs Safe Browsing
  // from the key alone. Default to "google" (Gemini); user should label safebrowsing keys in API Center.
  if (key.startsWith("AIza")) return "google";
  if (key.startsWith("AQ.")) return "google";
  if (/^[A-Za-z0-9]{30,35}$/.test(key)) return "mistral";
  if (key.startsWith("sk-") && key.length >= 40) return "openai";
  if (key.startsWith("nvapi-")) return "nvidia";
  return null;
}

export { PROVIDERS };
