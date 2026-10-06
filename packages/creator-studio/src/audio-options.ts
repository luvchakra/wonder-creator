/**
 * The Audio page (docs/ui-redesign/creation-pages.md, step 3). Client-safe: no database access.
 *
 * An Audio Creation is a recording (a take, kept as a voice Material) and its words — a script, lyrics, notes, or the
 * transcript. Which take plays lives in the Creation's version (`structured_content`); recording again is a new
 * version, and every earlier take stays a Material and can be brought back by restoring the version.
 */
export interface AudioTake {
  materialId: string;
  seconds: number;
}
/**
 * Background music under the take (owner, 6 Oct 2026): a track from the CreativeRadio library, trimmed, at a tempo and a
 * level. Tempo keeps the pitch. The track's credit is taken from the library on the server, never from the browser,
 * and travels with anything published (the library is CC BY 4.0 / CC0).
 */
export interface AudioBed {
  trackId: string;
  title: string;
  artist: string;
  license: string;
  /** The credit the license asks for, as the library states it. */
  attribution: string | null;
  /** Trim: where in the track the music starts and ends, in seconds of the original. */
  from: number;
  to: number;
  /** 0.75–1.25; 1 is as recorded. */
  tempo: number;
  /** 0–1, the music's level under the voice. */
  level: number;
}
/** The take and the music, mixed on the creator's device and kept as an audio Material: what plays, and what's published. */
export interface AudioMix {
  materialId: string;
  seconds: number;
}
export interface AudioSet {
  kind: "audio";
  take: AudioTake | null;
  bed?: AudioBed | null;
  mix?: AudioMix | null;
}

export const BED_TEMPO = { min: 0.75, max: 1.25, step: 0.05, default: 1 } as const;
export const BED_LEVEL = { min: 0, max: 1, step: 0.05, default: 0.35 } as const;
/** The music fades out over this long at its end (and in over a moment at its start), so it never stops abruptly. */
export const BED_FADE_SECONDS = 2.5;

const uuid = (x: unknown): x is string => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x);
const num = (x: unknown, lo: number, hi: number, fallback: number) => (typeof x === "number" && Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : fallback);

export function bedOf(raw: unknown): AudioBed | null {
  const b = raw as Partial<Record<keyof AudioBed, unknown>> | null;
  if (!b || typeof b.trackId !== "string" || !/^[a-z0-9-]{1,80}$/i.test(b.trackId)) return null;
  const from = num(b.from, 0, 24 * 3600, 0);
  const to = num(b.to, from + 1, 24 * 3600, from + 1);
  return {
    trackId: b.trackId,
    title: typeof b.title === "string" ? b.title.slice(0, 200) : "Music",
    artist: typeof b.artist === "string" ? b.artist.slice(0, 200) : "",
    license: typeof b.license === "string" ? b.license.slice(0, 80) : "",
    attribution: typeof b.attribution === "string" ? b.attribution.slice(0, 600) : null,
    from,
    to,
    tempo: num(b.tempo, BED_TEMPO.min, BED_TEMPO.max, BED_TEMPO.default),
    level: num(b.level, BED_LEVEL.min, BED_LEVEL.max, BED_LEVEL.default),
  };
}

export function audioSetOf(structured: unknown): AudioSet {
  const raw = structured as { kind?: string; take?: { materialId?: unknown; seconds?: unknown } | null; bed?: unknown; mix?: { materialId?: unknown; seconds?: unknown } | null } | null;
  if (!raw || raw.kind !== "audio" || !raw.take || !uuid(raw.take.materialId)) return { kind: "audio", take: null };
  const seconds = typeof raw.take.seconds === "number" && Number.isFinite(raw.take.seconds) ? Math.max(0, Math.round(raw.take.seconds)) : 0;
  const bed = bedOf(raw.bed);
  const mix = bed && raw.mix && uuid(raw.mix.materialId) ? { materialId: raw.mix.materialId, seconds: num(raw.mix.seconds, 0, 6 * 3600, seconds) } : null;
  return { kind: "audio", take: { materialId: raw.take.materialId, seconds }, bed, mix };
}

/** How long the music sounds once trimmed and at its tempo. */
export const bedLength = (b: Pick<AudioBed, "from" | "to" | "tempo">) => Math.max(0, (b.to - b.from) / b.tempo);

/**
 * The credit published with the work: the library's own attribution, and what was changed (CC BY asks for both).
 */
export function bedCredit(b: AudioBed): string {
  const changes = [b.tempo !== 1 ? `tempo ${b.tempo < 1 ? "slowed" : "raised"} to ${Math.round(b.tempo * 100)}%` : null, "trimmed", "mixed under the voice"].filter(Boolean).join(", ");
  const base = b.attribution?.trim() || `“${b.title}” by ${b.artist}${b.license ? ` · ${b.license}` : ""}`;
  return `Music: ${base} (${changes})`;
}

export const clockOf = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
