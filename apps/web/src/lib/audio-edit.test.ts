import { describe, expect, it } from "vitest";
import { cut, encodeWav, isEdited, keptLength, nextPlayable, normalize, parseEdit, renderKept, trim, whole } from "./audio-edit";

describe("voice note edits", () => {
  it("trims, then cuts in several places, without touching the original timeline", () => {
    let k = whole(60);
    k = trim(k, 5, 55, 60);
    expect(k).toEqual([[5, 55]]);
    k = cut(k, 10, 12, 60);
    k = cut(k, 30, 40, 60);
    expect(k).toEqual([
      [5, 10],
      [12, 30],
      [40, 55],
    ]);
    expect(keptLength(k)).toBe(38);
    expect(isEdited(k, 60)).toBe(true);
    expect(isEdited(whole(60), 60)).toBe(false);
  });

  it("merges overlaps and drops slivers", () => {
    expect(normalize([[3, 1], [2, 5], [7, 7.01], [9, 20]], 10)).toEqual([[1, 5], [9, 10]]);
  });

  it("plays only what's kept", () => {
    const k: Array<[number, number]> = [[0, 2], [5, 8]];
    expect(nextPlayable(k, 1)).toBe(1);
    expect(nextPlayable(k, 3)).toBe(5);
    expect(nextPlayable(k, 8.5)).toBeNull();
  });

  it("reads back only well-formed edits", () => {
    expect(parseEdit({ keep: [[1, 2], ["x", 3], [4]] }, 10)).toEqual([[1, 2]]);
    expect(parseEdit({ keep: "nope" }, 10)).toBeNull();
    expect(parseEdit(null, 10)).toBeNull();
  });

  it("renders the kept parts and writes a valid WAV", () => {
    const rate = 1000;
    const src = new Float32Array(3000).fill(0.5);
    const out = renderKept(src, rate, [[0, 1], [2, 3]]);
    expect(out.length).toBe(2000);
    expect(out[500]).toBeCloseTo(0.5);
    expect(out[999]).toBeCloseTo(0); // faded at the join
    const wav = new DataView(encodeWav(out, rate));
    expect(String.fromCharCode(wav.getUint8(0), wav.getUint8(1), wav.getUint8(2), wav.getUint8(3))).toBe("RIFF");
    expect(wav.getUint32(24, true)).toBe(rate);
    expect(wav.byteLength).toBe(44 + 4000);
  });
});
