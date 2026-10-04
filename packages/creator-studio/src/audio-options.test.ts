import { describe, expect, it } from "vitest";
import { audioSetOf, clockOf } from "./audio-options";

describe("Audio page model", () => {
  it("reads the kept take tolerantly: nothing for what isn't a recording", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    expect(audioSetOf({ kind: "audio", take: { materialId: id, seconds: 61.6 } }).take).toEqual({ materialId: id, seconds: 62 });
    expect(audioSetOf({ kind: "audio", take: { materialId: id } }).take).toEqual({ materialId: id, seconds: 0 });
    expect(audioSetOf({ kind: "audio", take: { materialId: "nope" } }).take).toBeNull();
    expect(audioSetOf({ kind: "images", items: [] }).take).toBeNull();
    expect(audioSetOf(null).take).toBeNull();
  });

  it("shows time as m:ss", () => {
    expect(clockOf(0)).toBe("0:00");
    expect(clockOf(75)).toBe("1:15");
  });
});
