import { describe, expect, it } from "vitest";
import { detectIntent, resolveArtifactReference } from "./intent";

const none = { hasSelectedArtifact: false, hasMaterials: false };
const mats = { hasSelectedArtifact: false, hasMaterials: true };
const sel = { hasSelectedArtifact: true, hasMaterials: false };

describe("detectIntent", () => {
  it("creates when an output type is named", () => {
    expect(detectIntent("Turn these notes into a poem.", mats)).toMatchObject({ intent: "create", artifactType: "poem" });
    expect(detectIntent("Use these photographs and create a visual treatment.", mats)).toMatchObject({ intent: "create", artifactType: "visual_concept" });
  });
  it("discovers when the creator doesn't know", () => {
    expect(detectIntent("I don't know what this should become.", mats).intent).toBe("discover");
  });
  it("transforms an existing piece", () => {
    expect(detectIntent("Take the poem we made yesterday and make lyrics.", sel)).toMatchObject({ intent: "transform", artifactType: "lyrics" });
  });
  it("refines", () => {
    expect(detectIntent("Make this less formal.", sel)).toMatchObject({ intent: "refine", refinementAction: "tone" });
    expect(detectIntent("Make that darker.", none)).toMatchObject({ intent: "refine" });
    expect(detectIntent("make it shorter", sel).refinementAction).toBe("shorter");
  });
  it("detects memory corrections", () => {
    expect(detectIntent("That's not how I write.", none).intent).toBe("correct_memory");
    expect(detectIntent("Remember that I write in Hindi and English.", none).intent).toBe("remember");
  });
});

describe("resolveArtifactReference", () => {
  const now = new Date("2026-09-26T12:00:00Z");
  const recent = [
    { id: "a", title: "Father", type: "poem", updatedAt: "2026-09-25T10:00:00Z" },
    { id: "b", title: "Goa", type: "short_film", updatedAt: "2026-09-26T09:00:00Z" },
  ];
  it("uses the explicit selection", () => {
    expect(resolveArtifactReference("make that darker", "x", recent, now)).toEqual({ kind: "resolved", artifactId: "x" });
  });
  it("resolves 'the poem we made yesterday'", () => {
    expect(resolveArtifactReference("Take the poem we made yesterday and make lyrics", null, recent, now)).toEqual({ kind: "resolved", artifactId: "a" });
  });
  it("asks one focused question when 'that' is ambiguous", () => {
    const r = resolveArtifactReference("Make that darker.", null, recent, now);
    expect(r.kind).toBe("ask");
    if (r.kind === "ask") expect(r.options).toHaveLength(2);
  });
});
