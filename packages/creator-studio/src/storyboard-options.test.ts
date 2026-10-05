import { describe, expect, it } from "vitest";
import { blankShot, MAX_SHOTS, runtimeOf, storyboardOf, storyboardText } from "./storyboard-options";

describe("Video storyboards", () => {
  it("read a saved storyboard as it is", () => {
    const sb = { kind: "storyboard", shots: [{ id: "h1abc", frame: null, line: "He waits.", direction: "Wide", seconds: 6 }] };
    expect(storyboardOf(sb)).toEqual(sb);
  });

  it("open a script as shots: scene headings and Shot N lines start one, with any length named", () => {
    const script = ["INT. STATION - DAWN", "A man waits with his coat folded.", "", "**Shot 2: Close on the clock (3s)**", "6:10.", "", "EXT. PLATFORM 3 - DAY", "The train comes in."].join("\n");
    const sb = storyboardOf(null, script);
    expect(sb.shots.map((s) => [s.direction, s.line, s.seconds])).toEqual([
      ["INT. STATION - DAWN", "A man waits with his coat folded.", 4],
      ["Close on the clock (3s)", "6:10.", 3],
      ["EXT. PLATFORM 3 - DAY", "The train comes in.", 4],
    ]);
  });

  it("make each paragraph a shot when nothing marks them", () => {
    expect(storyboardOf(null, "Dawn at the station.\n\nThe clock.\n\nThe train.").shots.map((s) => s.line)).toEqual(["Dawn at the station.", "The clock.", "The train."]);
  });

  it("never throw on junk, cap the shots, and add up the runtime", () => {
    expect(storyboardOf({ kind: "storyboard", shots: "x" }, "").shots).toEqual([]);
    expect(storyboardOf(null, "a\n\n".repeat(MAX_SHOTS + 10)).shots.length).toBe(MAX_SHOTS);
    expect(runtimeOf({ kind: "storyboard", shots: [{ ...blankShot("a"), seconds: 4 }, { ...blankShot("b"), seconds: 7 }] })).toBe(11);
  });

  it("write the words as a shot list", () => {
    const sb = { kind: "storyboard" as const, shots: [{ ...blankShot("He waits."), direction: "Wide", seconds: 6 }, blankShot("")] };
    expect(storyboardText(sb)).toBe("## Shot 1 · 6s — Wide\n\nHe waits.\n\n## Shot 2 · 4s");
  });
});
