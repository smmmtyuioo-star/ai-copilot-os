export type KeyStatus = "healthy" | "unhealthy" | "unknown";

export interface ProviderModel {
  id: string;
  /** Best-effort guess at whether this model is free to use on this provider. */
  isFree: boolean;
  raw?: unknown;
}

export interface ProviderConfig {
  id: string; // e.g. "groq", "openrouter", "google", "deepseek", "mistral", "openai"
  name: string;
  baseUrl: string;
  /** Path that lists models. Almost every provider offers this, and it's free to call (no tokens spent). */
  listModelsPath: string;
  /** Build the auth header(s) for a request given the raw API key. */
  authHeaders: (apiKey: string) => Record<string, string>;
  /** Pull the model id list out of whatever shape this provider's /models response has. */
  parseModels: (body: unknown) => { id: string; raw: unknown }[];
  /** Heuristic: is a given model (by id/raw metadata) free on this provider? */
  isFreeModel: (model: { id: string; raw: unknown }) => boolean;
  /** Optional: how often to re-check this provider's keys, overriding the global default. */
  checkIntervalMs?: number;
}

export interface KeyRecord {
  providerId: string;
  /** Never log/print the raw key — store a short fingerprint instead for display. */
  keyFingerprint: string;
  apiKey: string; // kept in memory / your own secret store, not serialized by this module
  status: KeyStatus;
  lastCheckedAt: number | null;
  lastError: string | null;
  consecutiveFailures: number;
  availableFreeModels: ProviderModel[];
}

export interface HealthCheckResult {
  providerId: string;
  keyFingerprint: string;
  ok: boolean;
  httpStatus: number | null;
  error: string | null;
  models: ProviderModel[];
  checkedAt: number;
}
