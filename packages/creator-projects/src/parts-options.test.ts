import { describe, expect, it } from "vitest";
import { DEFAULT_ARTIFACT_TYPE, PART_KINDS, PART_TEMPLATES, PART_TEMPLATE_KEYS } from "./parts-options";

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
