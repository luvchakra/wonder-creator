import { log } from "@wonder/core";

/**
 * A quiet watch over how much one signed-in creator reads in an hour (docs/security.md › Automated access). It runs on
 * the instance with no database round trip (CLAUDE.md › Performance), so it counts what this instance sees: an
 * automated copy of the product has to read a great deal, and a person doesn't. Two thresholds, both generous:
 * past `WATCH_CALLS` or `WATCH_DISTINCT` it only logs (once an hour per creator, so it can be alerted on); past
 * `CEILING_CALLS` it refuses until the hour is up. Nothing here blocks on distinct pages: that is a signal, not a rule.
 */
export const WATCH_CALLS = 6_000;
export const CEILING_CALLS = 20_000;
export const WATCH_DISTINCT = 600;
const WINDOW_MS = 60 * 60_000;
const MAX_TRACKED = 5_000;

interface Tally {
  resetAt: number;
  calls: number;
  paths: Set<string>;
  flagged: boolean;
}
const tallies = new Map<string, Tally>();

/** Counts one API call by `userId`. Returns the seconds to wait when the hourly ceiling is passed, else null. */
export function noteUserCall(userId: string, path: string, now: number = Date.now()): number | null {
  let t = tallies.get(userId);
  if (!t || t.resetAt <= now) {
    t = { resetAt: now + WINDOW_MS, calls: 0, paths: new Set(), flagged: false };
    tallies.set(userId, t);
    if (tallies.size > MAX_TRACKED) for (const [k, v] of tallies) if (v.resetAt <= now) tallies.delete(k);
  }
  t.calls += 1;
  if (t.paths.size < WATCH_DISTINCT + 1) t.paths.add(path);
  const heavy = t.calls > WATCH_CALLS || t.paths.size > WATCH_DISTINCT;
  if (heavy && !t.flagged) {
    t.flagged = true;
    // The creator id is not logged beyond the auth user id the platform already knows; no content, no query strings.
    log("warn", "abuse.heavy_reader", { userId, calls: t.calls, distinctPaths: t.paths.size, windowEndsInS: Math.ceil((t.resetAt - now) / 1000) });
  }
  if (t.calls > CEILING_CALLS) {
    log("warn", "abuse.hourly_ceiling", { userId, calls: t.calls });
    return Math.max(1, Math.ceil((t.resetAt - now) / 1000));
  }
  return null;
}

/** Test hook. */
export function resetAbuseWatch() {
  tallies.clear();
}
