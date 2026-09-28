import type { Energy, MoodFilter, Track } from "./types";

/**
 * Queue building (spec §4–5, §11–13, §21). Deterministic given a seed, so a "refresh" gives a different but stable mix
 * and tests can pin the order.
 */

const ENERGY: Record<Energy, number> = { low: 0, medium: 1, high: 2 };

export interface RankInput {
  mood: MoodFilter;
  /** Most recent first. */
  history?: readonly string[];
  favorites?: readonly string[];
  /** Exclude (e.g. the current track). */
  exclude?: readonly string[];
  seed?: number;
}

/** Small deterministic hash → [0, 1). */
function jitter(id: string, seed: number): number {
  let h = 2166136261 ^ seed;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

export function tracksForMood<T extends Track>(tracks: readonly T[], mood: MoodFilter): T[] {
  return mood === "all" ? [...tracks] : tracks.filter((t) => t.moods.includes(mood));
}

/** A track *is* a mood when that's its primary mood (listed first); a secondary tag only means it also fits. */
export function isMood(t: Pick<Track, "moods">, mood: MoodFilter): boolean {
  return mood === "all" || t.moods[0] === mood;
}

/** Below this many tracks of a mood, the queue borrows tracks that also fit it. */
const MIN_MOOD_POOL = 3;

/**
 * score = moodMatch + preference + freshness − recentlyPlayed (§5). Focus prefers calm, instrumental tracks. Tracks
 * whose primary mood is the chosen one always rank before tracks that only also fit it (owner: a set mood must not
 * drift into other moods).
 */
export function rankTracks<T extends Track>(tracks: readonly T[], input: RankInput): T[] {
  const history = input.history ?? [];
  const fav = new Set(input.favorites ?? []);
  const exclude = new Set(input.exclude ?? []);
  const seed = input.seed ?? 0;
  const score = (t: T) => {
    let s = 0;
    if (input.mood !== "all") s += t.moods[0] === input.mood ? 20 : 2;
    if (input.mood === "focus") s += (t.energy === "low" ? 1 : t.energy === "medium" ? 0.5 : -1) + (t.instrumental ? 0.5 : -1);
    if (fav.has(t.id)) s += 0.75;
    const recent = history.indexOf(t.id);
    if (recent >= 0) s -= recent < 3 ? 4 : recent < 8 ? 2 : 0.5;
    return s + jitter(t.id, seed) * 1.5;
  };
  return tracksForMood(tracks, input.mood)
    .filter((t) => !exclude.has(t.id))
    .map((t) => ({ t, s: score(t) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.t);
}

/** An upcoming queue for a mood that keeps energy coherent (no low → high → low whiplash). */
export function buildQueue(tracks: readonly Track[], input: RankInput & { length?: number }): string[] {
  const all = rankTracks(tracks, input);
  // Only the mood's own tracks, unless there are too few of them.
  const own = all.filter((t) => isMood(t, input.mood));
  const ranked = own.length >= MIN_MOOD_POOL ? own : all;
  const length = input.length ?? 12;
  const out: Track[] = [];
  const pool = [...ranked];
  while (out.length < length && pool.length) {
    const last = out[out.length - 1];
    // Prefer the best-ranked track within one energy step of the last one.
    const i = last ? pool.findIndex((t) => Math.abs(ENERGY[t.energy] - ENERGY[last.energy]) <= 1) : 0;
    out.push(pool.splice(i >= 0 ? i : 0, 1)[0]!);
  }
  return out.map((t) => t.id);
}

/** "More like this" (§13): shared moods, then energy, genre and source. */
export function moreLikeThis(tracks: readonly Track[], of: Track, input: Omit<RankInput, "mood"> & { length?: number } = {}): string[] {
  const history = input.history ?? [];
  const sim = (t: Track) =>
    t.moods.filter((m) => of.moods.includes(m)).length * 2 +
    (t.energy === of.energy ? 1.5 : Math.abs(ENERGY[t.energy] - ENERGY[of.energy]) === 1 ? 0.5 : -1) +
    (t.genre && t.genre === of.genre ? 1 : 0) +
    (t.artist === of.artist ? 0.5 : 0) -
    (history.slice(0, 3).includes(t.id) ? 3 : 0) +
    jitter(t.id, input.seed ?? 0) * 0.5;
  return tracks
    .filter((t) => t.id !== of.id)
    .map((t) => ({ t, s: sim(t) }))
    .filter((x) => x.s > 1)
    .sort((a, b) => b.s - a.s)
    .slice(0, input.length ?? 10)
    .map((x) => x.t.id);
}

/** Previous (§21): past 5 seconds restarts the song; otherwise go back one. */
export function previousAction(currentTime: number, history: readonly string[]): { kind: "restart" } | { kind: "track"; id: string } {
  if (currentTime > 5 || !history.length) return { kind: "restart" };
  return { kind: "track", id: history[0]! };
}

export const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
