import { DomainError } from "../errors";

/**
 * Fixed-window rate limiter. In-memory per server instance; on multi-instance deployments this
 * is a best-effort first line (swap for a shared store via the same interface).
 */
export interface RateLimiter {
  check(key: string, limit: number, windowMs: number): void;
}

export function createMemoryRateLimiter(now: () => number = Date.now): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return {
    check(key, limit, windowMs) {
      const t = now();
      const b = buckets.get(key);
      if (!b || b.resetAt <= t) {
        buckets.set(key, { count: 1, resetAt: t + windowMs });
        if (buckets.size > 10_000) {
          for (const [k, v] of buckets) if (v.resetAt <= t) buckets.delete(k);
        }
        return;
      }
      b.count += 1;
      if (b.count > limit) {
        throw new DomainError("rate_limited", "You're going a little fast. Please try again in a moment.");
      }
    },
  };
}
