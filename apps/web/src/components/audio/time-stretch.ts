/**
 * Tempo without changing pitch, for background music (owner, 6 Oct 2026), by WSOLA: the audio is cut into overlapping
 * windows taken at the new tempo's pace, each nudged (within ±12 ms) to where it lines up best with what came before,
 * and laid back down at the original pace. The search runs on a mono sum, coarse then fine, and the same cuts are used
 * for every channel so the stereo picture holds. A 3-minute track takes about a second.
 */
export function stretch(channels: Float32Array[], rate: number, sampleRate: number): Float32Array[] {
  if (!channels.length || Math.abs(rate - 1) < 0.005) return channels.map((c) => c.slice());
  const input = channels[0]!.length;
  const N = Math.max(256, Math.round(sampleRate * 0.046) & ~1); // ~2048 at 44.1 kHz
  const Hs = N >> 1; // synthesis hop: half a window
  const Ha = Hs * rate; // analysis hop: the tempo
  const tol = Math.round(sampleRate * 0.012);
  const outLen = Math.max(0, Math.floor(input / rate));
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  const mono = new Float32Array(input);
  for (const c of channels) for (let i = 0; i < input; i++) mono[i]! += c[i]! / channels.length;

  const out = channels.map(() => new Float32Array(outLen + N));
  const weight = new Float32Array(outLen + N);
  const overlap = Hs;
  // How well the stretch at `cand` continues the natural next stretch of the last window (`target`).
  const score = (target: number, cand: number, step: number) => {
    let s = 0;
    for (let i = 0; i < overlap; i += step) s += (mono[target + i] ?? 0) * (mono[cand + i] ?? 0);
    return s;
  };
  let prev = 0;
  for (let k = 0; ; k++) {
    const at = k * Hs;
    if (at >= outLen) break;
    const nominal = Math.round(k * Ha);
    let pos = Math.min(Math.max(0, nominal), Math.max(0, input - 1));
    if (k > 0) {
      const target = prev + Hs;
      if (target + overlap < input) {
        const lo = Math.max(0, nominal - tol);
        const hi = Math.min(input - overlap - 1, nominal + tol);
        let best = pos;
        let bestScore = -Infinity;
        for (let c = lo; c <= hi; c += 4) {
          const v = score(target, c, 4);
          if (v > bestScore) [bestScore, best] = [v, c];
        }
        for (let c = Math.max(lo, best - 3); c <= Math.min(hi, best + 3); c++) {
          const v = score(target, c, 1);
          if (v > bestScore) [bestScore, best] = [v, c];
        }
        pos = best;
      }
    }
    for (let i = 0; i < N; i++) {
      const src = pos + i;
      if (src >= input) break;
      const w = win[i]!;
      for (let ch = 0; ch < channels.length; ch++) out[ch]![at + i]! += channels[ch]![src]! * w;
      weight[at + i]! += w;
    }
    prev = pos;
  }
  return out.map((o) => {
    const r = new Float32Array(outLen);
    for (let i = 0; i < outLen; i++) r[i] = weight[i]! > 1e-3 ? o[i]! / weight[i]! : o[i]!;
    return r;
  });
}
