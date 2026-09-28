import { describe, expect, it } from "vitest";
import { directionsFor, groupSources, outputModeOf, suggestFragments, unusedNudge, usageOptionsFor, workingSetSummary, type WorkingSource } from "./working-set-options";

const src = (over: Partial<WorkingSource>): WorkingSource => ({
  id: "x",
  sourceType: "material",
  sourceId: "m",
  state: "available",
  roles: [],
  fragment: null,
  addedAt: "",
  available: true,
  title: "T",
  kind: "Photo",
  mediaType: "image",
  href: null,
  thumbnailUrl: null,
  ...over,
});

describe("Working Set rules", () => {
  it("summarises the table the way the Studio pill does", () => {
    expect(workingSetSummary([])).toBe("No sources yet");
    expect(workingSetSummary([src({ state: "in_use" }), src({ state: "pinned" }), src({})])).toBe("3 sources · 2 in use");
    expect(workingSetSummary([src({})])).toBe("1 source");
  });

  it("groups Pinned, In use, Available in that order and drops empty groups", () => {
    const g = groupSources([src({ id: "a", state: "available" }), src({ id: "b", state: "pinned" })]);
    expect(g.map((x) => x.state)).toEqual(["pinned", "available"]);
  });

  it("offers directions from roles: voice + visual → spoken word; several visuals with a story → photo essay; a visual → carousel", () => {
    const d = directionsFor([src({ roles: ["voice", "story"], mediaType: "voice" }), src({ roles: ["visual"] }), src({ roles: ["visual"] })]).map((x) => x.key);
    expect(d.slice(0, 3)).toEqual(["spoken", "essay", "carousel"]);
    expect(directionsFor([src({ roles: ["fact"] })]).map((x) => x.key)).toEqual(["poem"]);
    expect(directionsFor([]).length).toBeGreaterThan(0);
  });

  it("nudges about unused sources without inventing anything", () => {
    expect(unusedNudge([src({ state: "in_use" })])).toBeNull();
    expect(unusedNudge([src({ state: "available", title: "Rain photograph" })])?.text).toBe("You haven't used “Rain photograph” yet.");
    expect(unusedNudge([src({}), src({ id: "y" })])?.text).toBe("2 sources are still unused.");
    expect(unusedNudge([src({ available: false })])).toBeNull();
  });

  it("suggests fragments as plain sentences with their offsets", () => {
    const text = "Every Sunday my father waited at Platform 3. The train was always late, but he was never in a hurry. Ok. The smell of chai and wet tracks.";
    const f = suggestFragments(text);
    expect(f.map((x) => x.text)).toEqual(["Every Sunday my father waited at Platform 3.", "The train was always late, but he was never in a hurry.", "The smell of chai and wet tracks."]);
    expect(text.slice(f[1]!.start!, f[1]!.end!)).toBe(f[1]!.text);
  });

  it("maps Creation types to output modes", () => {
    expect(outputModeOf("carousel")).toBe("carousel");
    expect(outputModeOf("poem")).toBe("writing");
    expect(outputModeOf("photo_essay")).toBe("image");
    expect(outputModeOf("unknown_type")).toBe("writing");
  });
  it("asks how to use a source with options from what it is and what the Creation is becoming", () => {
    const photo = usageOptionsFor(src({ mediaType: "image" }), "carousel");
    expect(photo[0]).toMatchObject({ intent: "visual", label: "Use it as a slide image" });
    expect(photo.map((o) => o.intent)).toEqual(["visual", "style", "mood", "reference"]);
    expect(usageOptionsFor(src({ mediaType: "image" }), "poem")[0]).toMatchObject({ intent: "content", label: "Write from what's in it" });
    const voice = usageOptionsFor(src({ mediaType: "voice" }), "carousel");
    expect(voice[0]!.label).toBe("Put its words on this slide");
    expect(voice.find((o) => o.part)?.intent).toBe("quote");
    expect(usageOptionsFor(src({ sourceType: "creation", mediaType: "poem" }), "carousel").map((o) => o.intent)).toEqual(["content", "quote", "structure", "style"]);
    expect(usageOptionsFor(src({ sourceType: "comment", mediaType: null }), "poem")[0]!.intent).toBe("constraint");
    for (const t of ["image", "voice", "pdf", "note"]) expect(usageOptionsFor(src({ mediaType: t }), "carousel").length).toBeLessThanOrEqual(4);
  });
});
