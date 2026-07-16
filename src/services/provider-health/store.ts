import type { KeyRecord, HealthCheckResult } from "./types";
import { getProvider } from "./providers";
import { checkProviderKey, fingerprint, isPermanentFailure } from "./health-check";

/** How many consecutive transient failures before we treat a key as unhealthy (not just a blip). */
const TRANSIENT_FAILURE_THRESHOLD = 3;

export class ProviderKeyStore {
  private keys = new Map<string, KeyRecord>(); // keyed by `${providerId}::${apiKey}`

  private id(providerId: string, apiKey: string) {
    return `${providerId}::${apiKey}`;
  }

  /** Add a key to be tracked. Does not check it yet — call checkOne/checkAll for that. */
  addKey(providerId: string, apiKey: string): KeyRecord {
    const id = this.id(providerId, apiKey);
    let rec = this.keys.get(id);
    if (!rec) {
      rec = {
        providerId,
        keyFingerprint: fingerprint(apiKey),
        apiKey,
        status: "unknown",
        lastCheckedAt: null,
        lastError: null,
        consecutiveFailures: 0,
        availableFreeModels: [],
      };
      this.keys.set(id, rec);
    }
    return rec;
  }

  removeKey(providerId: string, apiKey: string): void {
    this.keys.delete(this.id(providerId, apiKey));
  }

  getKey(providerId: string, apiKey: string): KeyRecord | undefined {
    return this.keys.get(this.id(providerId, apiKey));
  }

  listAll(): KeyRecord[] {
    return [...this.keys.values()];
  }

  listHealthy(): KeyRecord[] {
    return this.listAll().filter((k) => k.status === "healthy");
  }

  /** Runs one health check for a single key and updates its record + status in place. */
  async checkOne(providerId: string, apiKey: string): Promise<HealthCheckResult | null> {
    const provider = getProvider(providerId);
    const rec = this.getKey(providerId, apiKey);
    if (!provider || !rec) return null;

    const result = await checkProviderKey(provider, apiKey);
    rec.lastCheckedAt = result.checkedAt;

    if (result.ok) {
      rec.status = "healthy";
      rec.lastError = null;
      rec.consecutiveFailures = 0;
      rec.availableFreeModels = result.models.filter((m) => m.isFree);
    } else if (isPermanentFailure(result)) {
      // Bad/revoked key — no reason to keep retrying it. Prune immediately.
      rec.status = "unhealthy";
      rec.lastError = result.error;
      rec.consecutiveFailures += 1;
      rec.availableFreeModels = [];
    } else {
      // Transient (timeout, 5xx, rate limit) — only prune after repeated failures,
      // so one bad network blip doesn't yank a working key out of rotation.
      rec.consecutiveFailures += 1;
      rec.lastError = result.error;
      if (rec.consecutiveFailures >= TRANSIENT_FAILURE_THRESHOLD) {
        rec.status = "unhealthy";
        rec.availableFreeModels = [];
      }
      // else: leave status as whatever it was (stays "healthy" through a transient blip)
    }

    return result;
  }

  /** Runs health checks for every tracked key, in parallel. */
  async checkAll(): Promise<HealthCheckResult[]> {
    const results = await Promise.all(
      this.listAll().map((rec) => this.checkOne(rec.providerId, rec.apiKey)),
    );
    return results.filter((r): r is HealthCheckResult => r !== null);
  }

  /**
   * The actual thing you asked for: only free models from keys that are currently
   * verified working. Nothing from an unhealthy/unknown key is included.
   */
  getAvailableFreeModels(): { providerId: string; modelId: string; keyFingerprint: string }[] {
    const out: { providerId: string; modelId: string; keyFingerprint: string }[] = [];
    for (const rec of this.listHealthy()) {
      for (const m of rec.availableFreeModels) {
        out.push({ providerId: rec.providerId, modelId: m.id, keyFingerprint: rec.keyFingerprint });
      }
    }
    return out;
  }
}
