/**
 * A 16-bit PCM WAV file from rendered channels (Listen together's download, creative-room-parts.md step 4). Samples
 * are clamped to [-1, 1]; channels are interleaved. WAV is universal and needs no encoder library.
 */
export function encodeWav(channels: Float32Array[], sampleRate: number): ArrayBuffer {
  const count = Math.max(1, channels.length);
  const frames = channels[0]?.length ?? 0;
  const bytes = frames * count * 2;
  const buf = new ArrayBuffer(44 + bytes);
  const v = new DataView(buf);
  const text = (at: number, s: string) => [...s].forEach((c, i) => v.setUint8(at + i, c.charCodeAt(0)));
  text(0, "RIFF");
  v.setUint32(4, 36 + bytes, true);
  text(8, "WAVE");
  text(12, "fmt ");
  v.setUint32(16, 16, true); // PCM header size
  v.setUint16(20, 1, true); // PCM
  v.setUint16(22, count, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * count * 2, true); // byte rate
  v.setUint16(32, count * 2, true); // block align
  v.setUint16(34, 16, true); // bits per sample
  text(36, "data");
  v.setUint32(40, bytes, true);
  let at = 44;
  for (let i = 0; i < frames; i++) {
    for (let c = 0; c < count; c++) {
      const s = Math.max(-1, Math.min(1, channels[c]?.[i] ?? 0));
      v.setInt16(at, s < 0 ? s * 0x8000 : s * 0x7fff, true);
      at += 2;
    }
  }
  return buf;
}
