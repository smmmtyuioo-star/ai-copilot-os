import type { ProviderConfig, HealthCheckResult, ProviderModel } from "./types";

const DEFAULT_TIMEOUT_MS = 8000;

export function fingerprint(apiKey: string): string {
  // Never store/print the real key. Short, non-reversible-enough-for-display fingerprint.
  const tail = apiKey.slice(-4);
  return `${apiKey.slice(0, 3)}...${tail} (${apiKey.length} chars)`;
}

/**
 * Calls the provider's /models endpoint with the given key. This is deliberately a
 * models-list call, not a completion — nearly every provider serves this for free/without
 * spending tokens, so health-checking never costs the user anything.
 */
export async function checkProviderKey(
  provider: ProviderConfig,
  apiKey: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<HealthCheckResult> {
  const checkedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  let url = provider.baseUrl + provider.listModelsPath;
  const headers: Record<string, string> = { Accept: "application/json", ...provider.authHeaders(apiKey) };

  // Google's Generative Language API takes the key as a query param, not a header.
  if (provider.id === "google") {
    url += `?key=${encodeURIComponent(apiKey)}`;
  }

  // Google Safe Browsing takes the key as a query param + needs specific POST body.
  if (provider.id === "google-safebrowsing") {
    url += `?key=${encodeURIComponent(apiKey)}`;
  }

  const isPost = provider.id === "google-safebrowsing";
  let postBody: string | undefined;
  if (provider.id === "google-safebrowsing") {
    postBody = JSON.stringify({
      client: { clientId: "provider-health", clientVersion: "1.0" },
      threatInfo: { threatTypes: ["MALWARE", "SOCIAL_ENGINEERING"], platformTypes: ["ANY_PLATFORM"], threatEntryTypes: ["URL"], threatEntries: [{ url: "https://example.com" }] },
    });
  }

  try {
    const res: Response = await fetch(url, {
      headers: isPost ? { ...headers, "Content-Type": "application/json" } : headers,
      method: isPost ? "POST" : "GET",
      body: postBody,
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      const bodyText = await res.text().catch(() => "");
      return {
        providerId: provider.id,
        keyFingerprint: fingerprint(apiKey),
        ok: false,
        httpStatus: res.status,
        error: describeHttpError(res.status, bodyText),
        models: [],
        checkedAt,
      };
    }

    const body = await res.json();
    const rawModels = provider.parseModels(body);
    const models: ProviderModel[] = rawModels.map((m) => ({
      id: m.id,
      isFree: provider.isFreeModel(m),
      raw: m.raw,
    }));

    return {
      providerId: provider.id,
      keyFingerprint: fingerprint(apiKey),
      ok: true,
      httpStatus: res.status,
      error: null,
      models,
      checkedAt,
    };
  } catch (err) {
    clearTimeout(timer);
    const isAbort = err instanceof Error && err.name === "AbortError";
    return {
      providerId: provider.id,
      keyFingerprint: fingerprint(apiKey),
      ok: false,
      httpStatus: null,
      error: isAbort ? `Timed out after ${timeoutMs}ms` : String((err as Error)?.message ?? err),
      models: [],
      checkedAt,
    };
  }
}

function describeHttpError(status: number, bodyText: string): string {
  if (status === 401 || status === 403) return `Invalid or revoked API key (HTTP ${status})`;
  if (status === 429) return `Rate limited (HTTP 429) — key may still be valid, retry later`;
  if (status >= 500) return `Provider server error (HTTP ${status}) — likely transient`;
  const snippet = bodyText.slice(0, 200);
  return `HTTP ${status}${snippet ? `: ${snippet}` : ""}`;
}

/** 401/403 mean the key itself is bad — no point retrying. Everything else may be transient. */
export function isPermanentFailure(result: HealthCheckResult): boolean {
  return result.httpStatus === 401 || result.httpStatus === 403;
}
