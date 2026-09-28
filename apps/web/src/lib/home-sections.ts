/**
 * Home (owner's board, 28 Sep 2026): the rules that decide what each section shows. Pure, so they're tested on their
 * own. Every section is real data or it isn't shown — nothing is invented to fill the page.
 */

/** Things that happened, shown under "While you were away". */
export const UPDATE_KINDS = new Set(["shared_with_you", "proposal_decided", "collaborator_added", "license_response", "message", "visuals_ready"]);
/** Someone (or CreativeMind) waiting on the creator: "You could help". */
export const ASK_KINDS = new Set(["proposal", "join_request", "huddle_invite", "license_request", "proposal_review", "crew_invite", "crew_question", "rights_claim"]);

export interface HomeItem {
  id: string;
  kind: string;
  title: string;
  href: string;
  at: string;
  actor?: { id: string | null; name: string };
}

/** Without a previous visit (the first one), "away" means the last few days. */
const FIRST_VISIT_WINDOW_MS = 3 * 24 * 3600_000;

export function splitHomeItems(items: HomeItem[], lastVisit: string | null, now = Date.now()) {
  const since = lastVisit ?? new Date(now - FIRST_VISIT_WINDOW_MS).toISOString();
  const byNewest = [...items].sort((a, b) => b.at.localeCompare(a.at));
  return {
    away: byNewest.filter((i) => UPDATE_KINDS.has(i.kind) && i.at > since),
    asks: byNewest.filter((i) => ASK_KINDS.has(i.kind)),
  };
}

export interface SparkCandidate {
  id: string;
  title: string | null;
  created_at: string;
}

const DAY = 86_400_000;
/** Only things old enough to feel like a memory. */
export const SPARK_MIN_AGE_DAYS = 60;

/**
 * "A little spark": one older Material to rediscover. An anniversary (within two weeks of a year, two years…) wins;
 * otherwise a pick that changes day by day but stays put through the day (no reshuffling on refresh).
 */
export function pickSpark<T extends SparkCandidate>(candidates: T[], now = Date.now()): T | null {
  const old = candidates.filter((c) => now - Date.parse(c.created_at) >= SPARK_MIN_AGE_DAYS * DAY);
  if (!old.length) return null;
  const anniversary = old.find((c) => {
    const days = (now - Date.parse(c.created_at)) / DAY;
    const off = days % 365;
    return days >= 350 && (off <= 14 || off >= 351);
  });
  if (anniversary) return anniversary;
  const day = Math.floor(now / DAY);
  return [...old].sort((a, b) => a.id.localeCompare(b.id))[day % old.length]!;
}

/** "A year ago", "2 years ago", "3 months ago". */
export function agoPhrase(iso: string, now = Date.now()): string {
  const days = (now - Date.parse(iso)) / DAY;
  if (days >= 350) {
    const years = Math.max(1, Math.round(days / 365));
    return years === 1 ? "A year ago" : `${years} years ago`;
  }
  const months = Math.max(2, Math.round(days / 30.4));
  return `${months} months ago`;
}
