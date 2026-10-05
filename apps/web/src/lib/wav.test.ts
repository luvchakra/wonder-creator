import { describe, expect, it } from "vitest";
import { encodeWav } from "./wav";

describe("encodeWav", () => {
  it("writes a 16-bit PCM header and interleaved, clamped samples", () => {
    const left = new Float32Array([0, 1, -1, 2]);
    const right = new Float32Array([0.5, -0.5, 0, -2]);
    const v = new DataView(encodeWav([left, right], 44_100));
    const ascii = (at: number, n: number) => String.fromCharCode(...Array.from({ length: n }, (_, i) => v.getUint8(at + i)));
    expect(ascii(0, 4)).toBe("RIFF");
    expect(ascii(8, 4)).toBe("WAVE");
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(44_100);
    expect(v.getUint16(34, true)).toBe(16);
    expect(v.getUint32(40, true)).toBe(16);
    expect(v.byteLength).toBe(44 + 16);
    const samples = Array.from({ length: 8 }, (_, i) => v.getInt16(44 + i * 2, true));
    expect(samples).toEqual([0, 16383, 32767, -16384, -32768, 0, 32767, -32768]);
  });
});
