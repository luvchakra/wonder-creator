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
import { describe as describeBed, expect as expectBed, it as itBed } from "vitest";
import { audioSetOf as setOf, bedCredit, bedLength, bedOf } from "./audio-options";

const T = "11111111-1111-4111-8111-111111111111";
const M = "22222222-2222-4222-8222-222222222222";
const bed = { trackId: "carefree", title: "Carefree", artist: "Kevin MacLeod", license: "CC BY 4.0", attribution: "“Carefree” Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 4.0 License.", from: 10, to: 70, tempo: 1.2, level: 0.4 };

describeBed("background music in a version", () => {
  itBed("reads the take, its music and its mix", () => {
    const s = setOf({ kind: "audio", take: { materialId: T, seconds: 30 }, bed, mix: { materialId: M, seconds: 52 } });
    expectBed(s.bed?.title).toBe("Carefree");
    expectBed(s.mix).toEqual({ materialId: M, seconds: 52 });
  });
  itBed("keeps values in bounds and ignores a mix without music", () => {
    expectBed(bedOf({ ...bed, tempo: 3, level: -1 })).toMatchObject({ tempo: 1.25, level: 0 });
    expectBed(bedOf({ ...bed, trackId: "../../etc" })).toBeNull();
    expectBed(setOf({ kind: "audio", take: { materialId: T, seconds: 30 }, mix: { materialId: M, seconds: 30 } }).mix).toBeNull();
  });
  itBed("knows how long the music sounds, and credits it with what changed", () => {
    expectBed(bedLength(bed)).toBe(50);
    const c = bedCredit(bed);
    expectBed(c).toMatch(/^Music: “Carefree” Kevin MacLeod/);
    expectBed(c).toContain("tempo raised to 120%");
    expectBed(c).toContain("trimmed");
  });
});
