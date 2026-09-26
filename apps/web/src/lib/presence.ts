import "server-only";
import { log } from "@wonder/core";
import { STALE_AFTER_SECONDS } from "@wonder/creator-huddle/lifecycle";
import { serviceClient, serviceConfigured } from "./supabase/service";

let lastSweep = 0;

/**
 * Opportunistic stale-presence sweep (throttled per server instance). The cron worker is the
 * durable fallback; this keeps discovery honest between cron runs.
 */
export async function sweepStalePresence(): Promise<void> {
  if (!serviceConfigured() || Date.now() - lastSweep < 60_000) return;
  lastSweep = Date.now();
  const { error } = await serviceClient().rpc("huddle_cleanup_stale", { p_timeout_seconds: STALE_AFTER_SECONDS });
  if (error) log("warn", "presence.sweep_failed", { code: error.code });
}
