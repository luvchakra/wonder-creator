import { createHash } from "node:crypto";
import { ago } from "./format";
import { SOURCE_NOUN, type CandidateDraft, type ContextRecord, type SourceType } from "./types";

/**
 * Cheap, deterministic grouping before any AI (spec §8): time and place clusters, a day that several sources agree on,
 * an unfinished thought worth returning to, a phrase the creator keeps writing. Ranking favours multi-source evidence
 * and meaningful rediscovery over raw recency, and never draws sensitive conclusions from the mere presence of a record.
 */

const DAY_MS = 86_400_000;

export interface GroupOptions {
  now: Date;
  /** IANA time zone for day boundaries and titles; UTC when unknown. */
  timeZone?: string;
  /** Candidates to return (Home shows up to 5). */
  limit?: number;
}

export function buildCandidates(records: ContextRecord[], opts: GroupOptions): CandidateDraft[] {
  const tz = opts.timeZone ?? "UTC";
  const unique = dedupe(records);
  const drafts = [...placeClusters(unique, tz, opts.now), ...dayClusters(unique, tz, opts.now), ...unfinished(unique, opts.now), ...recurring(unique)];
  drafts.sort((a, b) => b.score - a.score || a.signature.localeCompare(b.signature));
  // Keep groups distinct: a later group that mostly repeats an earlier one's records adds nothing.
  const used = new Set<string>();
  const out: CandidateDraft[] = [];
  for (const d of drafts) {
    const overlap = d.recordIds.filter((id) => used.has(id)).length;
    if (overlap > d.recordIds.length / 2) continue;
    out.push(d);
    d.recordIds.forEach((id) => used.add(id));
    if (out.length >= (opts.limit ?? 5)) break;
  }
  return out;
}

/** The same item reached through two sources (a photo in Photos and as a mail attachment) counts once. */
export function dedupe(records: ContextRecord[]): ContextRecord[] {
  const seen = new Set<string>();
  return records.filter((r) => {
    if (!r.fingerprint) return true;
    if (seen.has(r.fingerprint)) return false;
    seen.add(r.fingerprint);
    return true;
  });
}

function countsOf(rs: ContextRecord[]): Partial<Record<SourceType, number>> {
  const c: Partial<Record<SourceType, number>> = {};
  for (const r of rs) c[r.sourceType] = (c[r.sourceType] ?? 0) + 1;
  return c;
}

const sig = (kind: string, key: string) => `${kind}:${createHash("sha256").update(key).digest("hex").slice(0, 24)}`;
const dayKey = (iso: string, tz: string) => new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
const weekday = (iso: string, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "long" }).format(new Date(iso));
const dayMonth = (iso: string, tz: string) => new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short" }).format(new Date(iso));
const normPlace = (p: string) => p.trim().toLowerCase().replace(/\s+/g, " ");
const titleCase = (p: string) => p.trim().replace(/\s+/g, " ").replace(/\b\p{L}/gu, (c) => c.toUpperCase());

/** A user-authored line from the group's notes, if there is one. */
function quoteFrom(rs: ContextRecord[]): string | null {
  for (const r of rs) {
    if (r.sourceType !== "note" || !r.excerpt) continue;
    const first = r.excerpt.split(/(?<=[.!?…])\s/)[0]!.trim();
    if (first.length >= 12 && first.length <= 140 && !first.includes("[")) return first;
  }
  return null;
}

function score(rs: ContextRecord[], now: Date, base: number): number {
  const kinds = new Set(rs.map((r) => r.sourceType)).size;
  const newest = Math.max(...rs.map((r) => (r.occurredAt ? Date.parse(r.occurredAt) : 0)));
  const ageDays = (now.getTime() - newest) / DAY_MS;
  // Recent is good; a rediscovered memory (a month or more ago) is good too; the in-between gets a little less.
  const time = ageDays < 0 ? 0.5 : ageDays <= 7 ? 1 : ageDays >= 28 ? 0.8 : 0.6;
  return base + kinds * 3 + Math.log2(1 + rs.length) + time;
}

/** Records that share a place within a week: a trip or a day out. */
function placeClusters(rs: ContextRecord[], tz: string, now: Date): CandidateDraft[] {
  const byPlace = new Map<string, ContextRecord[]>();
  for (const r of rs) if (r.place && r.occurredAt) byPlace.set(normPlace(r.place), [...(byPlace.get(normPlace(r.place)) ?? []), r]);
  // Cross-source evidence (spec §8): a mail or note without a place joins a place's group when it names the place and
  // falls within three days of it — "a travel email near a calendar event".
  const unplaced = rs.filter((r) => !r.place && r.occurredAt && (r.title || r.excerpt));
  for (const [place, group] of byPlace) {
    if (place.length < 3) continue;
    const re = new RegExp(`(^|[^\\p{L}])${place.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^\\p{L}]|$)`, "iu");
    const times = group.map((r) => Date.parse(r.occurredAt!));
    const [lo, hi] = [Math.min(...times) - 3 * DAY_MS, Math.max(...times) + 3 * DAY_MS];
    for (const r of unplaced) {
      const t = Date.parse(r.occurredAt!);
      if (t >= lo && t <= hi && re.test(`${r.title ?? ""} ${r.excerpt ?? ""}`) && !group.includes(r)) group.push({ ...r, place: group[0]!.place });
    }
  }
  const out: CandidateDraft[] = [];
  for (const [place, group] of byPlace) {
    group.sort((a, b) => Date.parse(a.occurredAt!) - Date.parse(b.occurredAt!));
    // Split into runs no more than 7 days apart.
    let run: ContextRecord[] = [];
    const flush = () => {
      if (run.length >= 2) {
        const first = run[0]!.occurredAt!;
        const last = run[run.length - 1]!.occurredAt!;
        // A day out: everything within ~a day and most of it on one date (the booking mail the night before still counts).
        const days = new Map<string, string>();
        const tally = new Map<string, number>();
        for (const r of run) {
          const k = dayKey(r.occurredAt!, tz);
          days.set(k, r.occurredAt!);
          tally.set(k, (tally.get(k) ?? 0) + 1);
        }
        const [mainDay, mainCount] = [...tally.entries()].sort((x, y) => y[1] - x[1])[0]!;
        const oneDay = days.size === 1 || (Date.parse(last) - Date.parse(first) <= 1.5 * DAY_MS && mainCount / run.length >= 0.6);
        const dayAt = days.get(mainDay)!;
        const name = titleCase(run[0]!.place!);
        out.push({
          signature: sig("place", `${place}|${dayKey(first, tz)}`),
          title: oneDay ? `${weekday(dayAt, tz)} in ${name}` : `${name}, ${dayMonth(first, tz)}–${dayMonth(last, tz)}`,
          explanation: oneDay ? `A day in ${name}, from your ${kindsPhrase(run)}.` : `Your time in ${name}, from your ${kindsPhrase(run)}.`,
          quote: quoteFrom(run),
          recordIds: run.map((r) => r.id),
          counts: countsOf(run),
          score: score(run, now, 6),
        });
      }
      run = [];
    };
    for (const r of group) {
      if (run.length && Date.parse(r.occurredAt!) - Date.parse(run[run.length - 1]!.occurredAt!) > 7 * DAY_MS) flush();
      run.push(r);
    }
    flush();
  }
  return out;
}

/** A single day several sources agree on (without a shared place). */
function dayClusters(rs: ContextRecord[], tz: string, now: Date): CandidateDraft[] {
  const byDay = new Map<string, ContextRecord[]>();
  for (const r of rs) if (r.occurredAt && !r.place) byDay.set(dayKey(r.occurredAt, tz), [...(byDay.get(dayKey(r.occurredAt, tz)) ?? []), r]);
  const out: CandidateDraft[] = [];
  for (const [day, group] of byDay) {
    const kinds = new Set(group.map((r) => r.sourceType)).size;
    if (group.length < 3 || kinds < 2) continue;
    const at = group[0]!.occurredAt!;
    out.push({
      signature: sig("day", day),
      title: `${weekday(at, tz)}, ${dayMonth(at, tz)}`,
      explanation: `One day across your ${kindsPhrase(group)}.`,
      quote: quoteFrom(group),
      recordIds: group.map((r) => r.id),
      counts: countsOf(group),
      score: score(group, now, 2),
    });
  }
  return out;
}

/** A note the creator left mid-thought, a couple of weeks or more ago. */
function unfinished(rs: ContextRecord[], now: Date): CandidateDraft[] {
  return rs
    .filter((r) => r.sourceType === "note" && r.signals.unfinished === true && r.occurredAt && now.getTime() - Date.parse(r.occurredAt) >= 14 * DAY_MS)
    .map((r) => ({
      signature: sig("unfinished", r.id),
      title: "An unfinished thought",
      explanation: `From your notes · ${ago(r.occurredAt!, now)}`,
      quote: r.excerpt ? r.excerpt.slice(0, 140) : null,
      recordIds: [r.id],
      counts: { note: 1 },
      score: 4 + Math.min(2, (now.getTime() - Date.parse(r.occurredAt!)) / (60 * DAY_MS)),
    }));
}

const STOP = new Set(
  "a an and are as at be but by for from has have i in is it its me my of on or our so that the this to was we were with you your just about into than then them they there these those what when where which who will would could should not no yes do did done am been being he she his her him our ours us".split(
    " ",
  ),
);

/** A two-word phrase the creator wrote in three or more notes on different days. */
function recurring(rs: ContextRecord[]): CandidateDraft[] {
  const notes = rs.filter((r) => r.sourceType === "note" && r.excerpt);
  const seen = new Map<string, { ids: Set<string>; days: Set<string> }>();
  for (const n of notes) {
    const words = n.excerpt!.toLowerCase().match(/\p{L}[\p{L}'’-]*/gu) ?? [];
    const pairs = new Set<string>();
    for (let i = 0; i + 1 < words.length; i++) {
      const [a, b] = [words[i]!, words[i + 1]!];
      if (STOP.has(a) || STOP.has(b) || a.length < 3 || b.length < 3) continue;
      pairs.add(`${a} ${b}`);
    }
    for (const p of pairs) {
      const e = seen.get(p) ?? { ids: new Set(), days: new Set() };
      e.ids.add(n.id);
      e.days.add((n.occurredAt ?? "").slice(0, 10));
      seen.set(p, e);
    }
  }
  return [...seen.entries()]
    .filter(([, e]) => e.ids.size >= 3 && e.days.size >= 3)
    .sort((a, b) => b[1].ids.size - a[1].ids.size || a[0].localeCompare(b[0]))
    .slice(0, 1)
    .map(([phrase, e]) => ({
      signature: sig("phrase", phrase),
      title: `“${phrase}” keeps coming back`,
      explanation: `You've written it in ${e.ids.size} notes.`,
      quote: null,
      recordIds: [...e.ids],
      counts: { note: e.ids.size },
      score: 3 + e.ids.size,
    }));
}

function kindsPhrase(rs: ContextRecord[]): string {
  const kinds = [...new Set(rs.map((r) => SOURCE_NOUN[r.sourceType][1]))];
  return kinds.length === 1 ? kinds[0]! : `${kinds.slice(0, -1).join(", ")} and ${kinds[kinds.length - 1]}`;
}
