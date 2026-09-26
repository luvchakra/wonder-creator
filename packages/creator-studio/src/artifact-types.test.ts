import { describe, expect, it } from "vitest";
import { actionsFor, artifactType, inferArtifactType } from "./artifact-types";

describe("artifact types", () => {
  it("infers types from creator language", () => {
    expect(inferArtifactType("Turn these notes into a poem")).toBe("poem");
    expect(inferArtifactType("make lyrics from the poem")).toBe("lyrics");
    expect(inferArtifactType("I want to make a short film about my father")).toBe("short_film");
    expect(inferArtifactType("create a visual treatment")).toBe("visual_concept");
    expect(inferArtifactType("I don't know what this should become")).toBeNull();
  });
  it("offers a small, relevant set of actions", () => {
    const script = actionsFor("short_film");
    expect(script.length).toBeLessThanOrEqual(6);
    expect(script.map((a) => a.key)).toContain("storyboard");
    expect(actionsFor("poem").map((a) => a.targetType)).toContain("lyrics");
  });
  it("falls back gracefully for unknown types", () => {
    expect(artifactType("zine").label).toBe("Zine");
  });
});
