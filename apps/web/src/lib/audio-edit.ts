/**
 * Non-destructive edits to a voice note (owner, 21 Oct 2026: "play, pause, trim, cut multiple places"). The recording
 * itself is never changed (versions stay immutable): an edit is the list of the parts kept, in seconds of the original,
 * saved with the Material (`metadata.audioEdit`). Playback skips what was cut; export and share render the kept parts.
 */
export type Range = [number, number];

/** Rounded to milliseconds, sorted, merged, clipped to [0, duration], tiny slivers dropped. */
export function normalize(keep: Range[], duration: number): Range[] {
  const r = keep
    .map(([a, b]) => [Math.max(0, Math.min(a, b)), Math.min(duration, Math.max(a, b))] as Range)
    .map(([a, b]) => [Math.round(a * 1000) / 1000, Math.round(b * 1000) / 1000] as Range)
    .filter(([a, b]) => b - a >= 0.05)
    .sort((x, y) => x[0] - y[0]);
  const out: Range[] = [];
  for (const [a, b] of r) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

export const whole = (duration: number): Range[] => [[0, duration]];

/** Keep only what lies inside [start, end] (of the original). */
export function trim(keep: Range[], start: number, end: number, duration: number): Range[] {
  return normalize(keep.map(([a, b]) => [Math.max(a, start), Math.min(b, end)] as Range), duration);
}

/** Remove [start, end] (of the original) from what's kept. */
export function cut(keep: Range[], start: number, end: number, duration: number): Range[] {
  const out: Range[] = [];
  for (const [a, b] of keep) {
    if (end <= a || start >= b) out.push([a, b]);
    else {
      if (start > a) out.push([a, start]);
      if (end < b) out.push([end, b]);
    }
  }
  return normalize(out, duration);
}

export const keptLength = (keep: Range[]) => keep.reduce((s, [a, b]) => s + (b - a), 0);

export const isEdited = (keep: Range[], duration: number) => !(keep.length === 1 && keep[0]![0] <= 0.05 && keep[0]![1] >= duration - 0.05);

/** Where playback should be at original time `t`: inside a kept part, `t`; in a cut, the next kept part's start; past the end, null. */
export function nextPlayable(keep: Range[], t: number): number | null {
  for (const [a, b] of keep) {
    if (t < a) return a;
    if (t < b - 0.01) return t;
  }
  return null;
}

/** An edit read back from storage: only well-formed ranges survive. */
export function parseEdit(v: unknown, duration: number): Range[] | null {
  const keep = (v as { keep?: unknown } | null)?.keep;
  if (!Array.isArray(keep)) return null;
  const ranges = keep.filter((r): r is Range => Array.isArray(r) && r.length === 2 && r.every((n) => typeof n === "number" && Number.isFinite(n)));
  const n = normalize(ranges, duration);
  return n.length ? n : null;
}

/** 16-bit PCM WAV of mono samples (the export everyone can open). */
export function encodeWav(samples: Float32Array, sampleRate: number): ArrayBuffer {
  const buf = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buf);
  const str = (o: number, s: string) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, "RIFF");
  v.setUint32(4, 36 + samples.length * 2, true);
  str(8, "WAVE");
  str(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  str(36, "data");
  v.setUint32(40, samples.length * 2, true);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]!));
    v.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return buf;
}

/** The kept parts of mono `samples`, joined, with a 10 ms fade at each join so cuts don't click. */
export function renderKept(samples: Float32Array, sampleRate: number, keep: Range[]): Float32Array {
  const parts = keep.map(([a, b]) => samples.subarray(Math.floor(a * sampleRate), Math.min(samples.length, Math.ceil(b * sampleRate))));
  const out = new Float32Array(parts.reduce((s, p) => s + p.length, 0));
  const fade = Math.floor(sampleRate * 0.01);
  let o = 0;
  parts.forEach((p, i) => {
    out.set(p, o);
    if (parts.length > 1) {
      for (let k = 0; k < Math.min(fade, p.length); k++) {
        const g = k / fade;
        if (i > 0) out[o + k]! *= g;
        if (i < parts.length - 1) out[o + p.length - 1 - k]! *= g;
      }
    }
    o += p.length;
  });
  return out;
}
