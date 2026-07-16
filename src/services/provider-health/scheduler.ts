import type { ProviderKeyStore } from "./store";

export interface SchedulerOptions {
  /** How often to re-check every key, in ms. Default: 10 minutes. */
  intervalMs?: number;
  /** Called after every check pass — useful for logging/UI updates ("key X went unhealthy"). */
  onCheckComplete?: (summary: { healthy: number; unhealthy: number; unknown: number }) => void;
}

/**
 * Runs checkAll() on an interval so keys that start failing get pruned automatically,
 * and — just as importantly — keys that recover (e.g. a rate limit clears, a provider's
 * outage ends) get added back automatically instead of staying stuck unhealthy forever.
 */
export function startHealthScheduler(store: ProviderKeyStore, opts: SchedulerOptions = {}): () => void {
  const intervalMs = opts.intervalMs ?? 10 * 60 * 1000;

  const runOnce = async () => {
    await store.checkAll();
    if (opts.onCheckComplete) {
      const all = store.listAll();
      opts.onCheckComplete({
        healthy: all.filter((k) => k.status === "healthy").length,
        unhealthy: all.filter((k) => k.status === "unhealthy").length,
        unknown: all.filter((k) => k.status === "unknown").length,
      });
    }
  };

  // Check immediately on start, then on the interval.
  void runOnce();
  const timer = setInterval(runOnce, intervalMs);

  // Return a stop function so the caller can clean up (e.g. on server shutdown).
  return () => clearInterval(timer);
}
