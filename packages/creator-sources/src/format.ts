import { SOURCE_NOUN, type SourceType } from "./types";

const DAY_MS = 86_400_000;

/** "18 photos · 2 notes · 1 email", photos first. */
export function countsLine(counts: Partial<Record<SourceType, number>>): string {
  const order: SourceType[] = ["photo", "note", "email", "event", "file"];
  return order
    .filter((t) => counts[t])
    .map((t) => `${counts[t]} ${SOURCE_NOUN[t][counts[t] === 1 ? 0 : 1]}`)
    .join(" · ");
}

/** "4 months ago", "3 weeks ago", "yesterday". */
export function ago(iso: string, now: Date): string {
  const days = Math.floor((now.getTime() - Date.parse(iso)) / DAY_MS);
  if (days < 1) return "today";
  if (days < 2) return "yesterday";
  if (days < 14) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  const y = Math.floor(days / 365);
  return y === 1 ? "a year ago" : `${y} years ago`;
}
