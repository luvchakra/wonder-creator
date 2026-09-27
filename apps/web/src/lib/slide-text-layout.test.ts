import { describe, expect, it } from "vitest";
import { layoutText, wrapText } from "./slide-text-layout";

const mono = (s: string, px = 10) => s.length * px * 0.5;

describe("slide text layout", () => {
  it("wraps words to the width and keeps the creator's own line breaks", () => {
    expect(wrapText("one two three four", 40, (s) => s.length * 5)).toEqual(["one two", "three", "four"]);
    expect(wrapText("बारिश की\nपहली बूँद", 1000, (s) => s.length)).toEqual(["बारिश की", "पहली बूँद"]);
  });

  it("places the block at the top, centre or bottom inside a margin", () => {
    const base = { text: "Hello there", width: 1000, height: 1250, size: "m" as const, measure: mono };
    const top = layoutText({ ...base, position: "top" });
    const bottom = layoutText({ ...base, position: "bottom" });
    const center = layoutText({ ...base, position: "center" });
    expect(top.top).toBe(70);
    expect(bottom.top + bottom.blockHeight).toBe(1250 - 70);
    expect(center.top).toBe(Math.round((1250 - center.blockHeight) / 2));
  });

  it("shrinks a word too wide for the image instead of spilling", () => {
    const l = layoutText({ text: "Supercalifragilisticexpialidocious", width: 400, height: 500, size: "l", position: "center", measure: mono });
    expect(mono(l.lines[0]!, l.fontPx)).toBeLessThanOrEqual(400 - l.margin * 2);
  });
});
