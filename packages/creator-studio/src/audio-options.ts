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
export interface AudioSet {
  kind: "audio";
  take: AudioTake | null;
}

export function audioSetOf(structured: unknown): AudioSet {
  const raw = structured as { kind?: string; take?: { materialId?: unknown; seconds?: unknown } | null } | null;
  if (!raw || raw.kind !== "audio" || !raw.take || typeof raw.take.materialId !== "string" || !/^[0-9a-f-]{36}$/i.test(raw.take.materialId)) return { kind: "audio", take: null };
  const seconds = typeof raw.take.seconds === "number" && Number.isFinite(raw.take.seconds) ? Math.max(0, Math.round(raw.take.seconds)) : 0;
  return { kind: "audio", take: { materialId: raw.take.materialId, seconds } };
}

export const clockOf = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
