import { describe, expect, it } from "vitest";
import { assessIntent, briefSchema, renderBrief } from "./clarify";

const base = { mentionedTypes: [] as string[], materialCount: 0 };

describe("assessIntent", () => {
  it("proceeds without questions for a clear, short request", () => {
    const a = assessIntent("Write a poem about the monsoon", { ...base, artifactType: "poem", mentionedTypes: ["poem"] });
    expect(a.clarificationRequired).toBe(false);
    expect(a.recommendedNextAction).toBe("proceed");
    expect(a.missingInformation).toEqual([]);
    expect(a.safeAssumptions.length).toBeGreaterThan(0);
  });

  it("asks for length on long-form work unless the request gives one", () => {
    expect(assessIntent("Write a screenplay about my grandmother", { ...base, artifactType: "screenplay" }).missingInformation).toEqual(["length"]);
    expect(assessIntent("Write a 5 minute screenplay about my grandmother", { ...base, artifactType: "screenplay" }).clarificationRequired).toBe(false);
    expect(assessIntent("A short screenplay about my grandmother", { ...base, artifactType: "screenplay" }).clarificationRequired).toBe(false);
  });

  it("asks for the audience of audience-facing formats", () => {
    expect(assessIntent("Write a newsletter about the tour", { ...base, artifactType: "newsletter" }).missingInformation).toContain("audience");
    expect(assessIntent("Write a newsletter for my subscribers about the tour", { ...base, artifactType: "newsletter" }).missingInformation).not.toContain("audience");
  });

  it("asks which format when several were named", () => {
    const a = assessIntent("Turn this into a poem or maybe lyrics", { ...base, artifactType: "lyrics", mentionedTypes: ["lyrics", "poem"] });
    expect(a.missingInformation).toContain("format");
    expect(a.candidateTypes).toEqual(["lyrics", "poem"]);
  });

  it("asks which material to lead with only when there is a lot of it", () => {
    expect(assessIntent("Make a poem", { ...base, artifactType: "poem", materialCount: 2 }).missingInformation).toEqual([]);
    expect(assessIntent("Make a poem", { ...base, artifactType: "poem", materialCount: 4 }).missingInformation).toEqual(["emphasis"]);
    expect(assessIntent("Make a poem, focus on the photo", { ...base, artifactType: "poem", materialCount: 4 }).missingInformation).toEqual([]);
  });

  it("never silently assumes publishing, commercial use or imitation", () => {
    const a = assessIntent("Write a poem in the style of a famous poet and publish it to Instagram for a brand deal", { ...base, artifactType: "poem" });
    expect(a.clarificationRequired).toBe(true);
    expect(a.consequentialAssumptions.map((c) => c.key).sort()).toEqual(["commercial", "imitation", "publish"]);
  });

  it("confidence drops as more is missing", () => {
    const clear = assessIntent("A poem", { ...base, artifactType: "poem" });
    const vague = assessIntent("A pitch deck", { ...base, artifactType: "pitch_deck", materialCount: 5 });
    expect(vague.confidence).toBeLessThan(clear.confidence);
  });
});

describe("renderBrief", () => {
  it("renders only what was chosen", () => {
    const text = renderBrief(briefSchema.parse({ format: "screenplay", length: "short", audience: "festival jury", style: "experiment" }));
    expect(text).toContain("Format: Screenplay");
    expect(text).toContain("Audience: festival jury");
    expect(text).toContain("experiment");
    expect(text).not.toContain("Tone:");
  });
});
