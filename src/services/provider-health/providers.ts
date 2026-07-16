import type { ProviderConfig } from "./types";

/**
 * IMPORTANT: "isFreeModel" heuristics below are best-effort and WILL go stale — providers
 * change pricing/free-tier terms often. Treat these as a starting point, not ground truth.
 * Where possible we detect "free" from the API response itself (price = 0) rather than
 * hardcoding model names, since that's the only thing that can't silently go out of date.
 */

function openAIStyleParse(body: unknown): { id: string; raw: unknown }[] {
  const data = (body as any)?.data;
  if (!Array.isArray(data)) return [];
  return data.map((m: any) => ({ id: m.id, raw: m }));
}

export const PROVIDERS: ProviderConfig[] = [
  {
    id: "openrouter",
    name: "OpenRouter",
    baseUrl: "https://openrouter.ai/api/v1",
    listModelsPath: "/models",
    authHeaders: (key) => ({ Authorization: `Bearer ${key}` }),
    parseModels: openAIStyleParse,
    // OpenRouter reports pricing directly in the model list — trust that over the id string,
    // but the ":free" suffix convention is a reliable secondary signal.
    isFreeModel: (m) => {
      const pricing = (m.raw as any)?.pricing;
      const promptFree = pricing && Number(pricing.prompt) === 0;
      const completionFree = pricing && Number(pricing.completion) === 0;
      return Boolean(promptFree && completionFree) || m.id.endsWith(":free");
    },
  },
  {
    id: "groq",
    name: "Groq",
    baseUrl: "https://api.groq.com/openai/v1",
    listModelsPath: "/models",
    authHeaders: (key) => ({ Authorization: `Bearer ${key}` }),
    parseModels: openAIStyleParse,
    // Groq's public API has been free (rate-limited) for all listed models historically.
    // VERIFY this is still true before relying on it — if they introduce paid tiers this
    // needs to become a real per-model check.
    isFreeModel: () => true,
  },
  {
    id: "google",
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    listModelsPath: "/models",
    // Gemini uses a query-param key, not a header — see health-check.ts special-case.
    authHeaders: () => ({}),
    parseModels: (body) => {
      const models = (body as any)?.models;
      if (!Array.isArray(models)) return [];
      return models.map((m: any) => ({ id: m.name, raw: m }));
    },
    // Gemini Flash-tier models generally have a free quota; Pro-tier generally doesn't.
    // This is a naming heuristic, not a pricing lookup — VERIFY against current Google
    // AI Studio pricing before trusting it for anything cost-sensitive.
    isFreeModel: (m) => /flash/i.test(m.id) && !/preview/i.test(m.id),
  },
  {
    id: "mistral",
    name: "Mistral",
    baseUrl: "https://api.mistral.ai/v1",
    listModelsPath: "/models",
    authHeaders: (key) => ({ Authorization: `Bearer ${key}` }),
    parseModels: openAIStyleParse,
    // Mistral's "La Plateforme" free tier is rate-limited access to specific small models.
    // No reliable signal in /models itself — treat all as paid unless you maintain your
    // own allowlist of currently-free model ids.
    isFreeModel: () => false,
  },
  {
    id: "openai",
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    listModelsPath: "/models",
    authHeaders: (key) => ({ Authorization: `Bearer ${key}` }),
    parseModels: openAIStyleParse,
    isFreeModel: () => false, // no free API tier as of this module's writing
  },
  {
    id: "together",
    name: "Together AI",
    baseUrl: "https://api.together.xyz/v1",
    listModelsPath: "/models",
    authHeaders: (key) => ({ Authorization: `Bearer ${key}` }),
    parseModels: openAIStyleParse,
    // Together sometimes runs specific "-free" tagged models; check the pricing field if present.
    isFreeModel: (m) => {
      const pricing = (m.raw as any)?.pricing;
      if (pricing && (Number(pricing.input) === 0 || Number(pricing.hourly) === 0)) return true;
      return /-free$/i.test(m.id);
    },
  },
  {
    id: "nvidia",
    name: "NVIDIA",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    listModelsPath: "/models",
    authHeaders: (key) => ({ Authorization: `Bearer ${key}` }),
    parseModels: openAIStyleParse,
    isFreeModel: () => true,
  },
  {
    id: "google-safebrowsing",
    name: "Google Safe Browsing",
    baseUrl: "https://safebrowsing.googleapis.com/v4",
    listModelsPath: "/threatMatches:find",
    authHeaders: () => ({ "Content-Type": "application/json" }),
    parseModels: (body) => {
      // {} means no threats = API works
      return [{ id: "safe-browsing-v4", raw: body }];
    },
    isFreeModel: () => true,
  },
];

export function getProvider(id: string): ProviderConfig | undefined {
  return PROVIDERS.find((p) => p.id === id);
}
