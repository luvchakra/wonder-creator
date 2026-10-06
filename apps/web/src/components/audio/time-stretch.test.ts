import { describe, expect, it } from "vitest";
import { stretch } from "./time-stretch";

const RATE = 44_100;
const tone = (hz: number, seconds: number) => Float32Array.from({ length: Math.round(RATE * seconds) }, (_, i) => Math.sin((2 * Math.PI * hz * i) / RATE) * 0.5);
// Frequency from upward zero crossings over the middle of the signal (edges are faded by the windows).
const pitchOf = (x: Float32Array) => {
  const a = Math.floor(x.length * 0.2);
  const b = Math.floor(x.length * 0.8);
  let n = 0;
  for (let i = a + 1; i < b; i++) if (x[i - 1]! < 0 && x[i]! >= 0) n++;
  return n / ((b - a) / RATE);
};

describe("stretch (tempo, pitch kept)", () => {
  it("faster is shorter, and the pitch stays", () => {
    const [out] = stretch([tone(440, 2)], 1.25, RATE);
    expect(out!.length).toBe(Math.floor((RATE * 2) / 1.25));
    expect(pitchOf(out!)).toBeGreaterThan(430);
    expect(pitchOf(out!)).toBeLessThan(450);
  });
  it("slower is longer, and the pitch stays", () => {
    const [out] = stretch([tone(440, 2)], 0.75, RATE);
    expect(out!.length).toBe(Math.floor((RATE * 2) / 0.75));
    expect(Math.abs(pitchOf(out!) - 440)).toBeLessThan(10);
  });
  it("keeps every channel in step, and leaves tempo 1 alone", () => {
    const l = tone(330, 1);
    const r = tone(660, 1);
    const out = stretch([l, r], 1.1, RATE);
    expect(out).toHaveLength(2);
    expect(out[0]!.length).toBe(out[1]!.length);
    expect(Array.from(stretch([l], 1, RATE)[0]!.slice(0, 50))).toEqual(Array.from(l.slice(0, 50)));
  });
});
