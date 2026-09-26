import type { Db } from "@wonder/db";
import { DomainError } from "../errors";
import { log } from "../log";

/** Fixed-window rate limiter. Throws a creator-readable `rate_limited` DomainError past the limit. */
export interface RateLimiter {
  check(key: string, limit: number, windowMs: number): Promise<void>;
}

const tooFast = () => new DomainError("rate_limited", "You're going a little fast. Please try again in a moment.");

/** Per-instance limiter: a cheap first line, and the fallback when the shared store is unreachable. */
export function createMemoryRateLimiter(now: () => number = Date.now): RateLimiter {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return {
    async check(key, limit, windowMs) {
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
      if (b.count > limit) throw tooFast();
    },
  };
}

/**
 * Limiter shared by every server instance, backed by the `rate_limit_hit` RPC (service role only).
 * The local limiter runs first so bursts are rejected without a database round trip; if the shared
 * store fails, requests are still limited per instance (logged, never an outage).
 */
export function createSharedRateLimiter(service: () => Db | null, local: RateLimiter = createMemoryRateLimiter()): RateLimiter {
  return {
    async check(key, limit, windowMs) {
      await local.check(key, limit, windowMs);
      const db = service();
      if (!db) return;
      const { data, error } = await db.rpc("rate_limit_hit", { p_key: key.slice(0, 300), p_limit: limit, p_window_seconds: Math.max(1, Math.round(windowMs / 1000)) });
      if (error) {
        log("warn", "rate_limit.shared_unavailable", { code: error.code });
        return;
      }
      if (data === false) throw tooFast();
    },
  };
}
