import { describe, expect, it } from "vitest";
import { DEFAULT_ARTIFACT_TYPE, PART_KINDS, PART_TEMPLATES, PART_TEMPLATE_KEYS, heardEarlier, mixLength, mixTrackOf, offsetLabel, placeAt } from "./parts-options";

describe("Parts templates", () => {
  it("lay out distinct, well-formed parts of known kinds", () => {
    for (const key of PART_TEMPLATE_KEYS) {
      const t = PART_TEMPLATES[key];
      const titles = t.parts.map((p) => p.title);
      expect(new Set(titles).size).toBe(titles.length);
      for (const p of t.parts) {
        expect(PART_KINDS).toContain(p.kind);
        expect(p.title.length).toBeLessThanOrEqual(60);
        expect(p.artifactType).toMatch(/^[a-z_]+$/);
      }
      expect(t.hint).toBe(titles.join(" · "));
    }
  });

  it("every kind has a default Creation type", () => {
    for (const k of PART_KINDS) expect(DEFAULT_ARTIFACT_TYPE[k]).toBeTruthy();
  });

  it("a song is lyrics, a tune and a voice", () => {
    expect(PART_TEMPLATES.song.parts.map((p) => [p.title, p.kind])).toEqual([
      ["Lyrics", "writing"],
      ["Tune", "audio"],
      ["Voice", "audio"],
    ]);
  });
});

describe("Listen together: the mix's timing", () => {
  const tracks = [
    { partId: "tune", seconds: 40 },
    { partId: "voice", seconds: 30 },
  ];
  it("lasts until the last sounding track ends; muted or silent tracks don't count", () => {
    expect(mixLength(tracks, {})).toBe(40);
    expect(mixLength(tracks, { voice: { offsetMs: 15_000, gain: 1, muted: false } })).toBe(45);
    expect(mixLength(tracks, { voice: { offsetMs: 15_000, gain: 1, muted: true } })).toBe(40);
    expect(mixLength(tracks, { tune: { offsetMs: 0, gain: 0, muted: false } })).toBe(30);
    expect(mixLength([], {})).toBe(0);
  });
  it("places a track for any playhead: waits for a late start, starts part-way in after it, and ends", () => {
    expect(placeAt(2000, 30, 0)).toEqual({ wait: 2, from: 0 });
    expect(placeAt(2000, 30, 5)).toEqual({ wait: 0, from: 3 });
    expect(placeAt(-1500, 30, 0)).toEqual({ wait: 0, from: 1.5 });
    expect(placeAt(0, 30, 30)).toBeNull();
  });
  it("defaults a part nobody has touched to as recorded, and says offsets plainly", () => {
    expect(mixTrackOf({}, "x")).toEqual({ offsetMs: 0, gain: 1, muted: false });
    expect(offsetLabel(0)).toBe("from the start");
    expect(offsetLabel(1200)).toBe("+1.2s");
    expect(offsetLabel(-500)).toBe("−0.5s");
    expect(offsetLabel(12_000)).toBe("+12s");
  });
});

describe("Notes on a moment: which takes they were left on", () => {
  const heard = [
    { partId: "tune", title: "Tune", versionNumber: 2 },
    { partId: "voice", title: "Voice", versionNumber: 1 },
  ];
  it("says nothing while the takes are the same, and names them once one has moved on", () => {
    expect(heardEarlier(heard, [{ partId: "tune", versionNumber: 2 }, { partId: "voice", versionNumber: 1 }])).toBeNull();
    expect(heardEarlier(heard, [{ partId: "tune", versionNumber: 3 }, { partId: "voice", versionNumber: 1 }])).toBe("on Tune v2 · Voice v1");
    // A take no longer heard at all isn't "moved on".
    expect(heardEarlier(heard, [{ partId: "voice", versionNumber: 1 }])).toBeNull();
  });
});
