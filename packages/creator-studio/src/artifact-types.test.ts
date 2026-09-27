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

describe("publication derivatives", () => {
  it("offer platform adaptations that suit the source, never the same type", async () => {
    const { publicationDerivativesFor } = await import("./artifact-types");
    const film = publicationDerivativesFor("short_film").map((p) => p.key);
    expect(film).toEqual(expect.arrayContaining(["trailer", "instagram_carousel", "youtube_description", "thumbnail"]));
    const poem = publicationDerivativesFor("poem").map((p) => p.key);
    expect(poem).toContain("visual_post");
    expect(publicationDerivativesFor("trailer").map((p) => p.targetType)).not.toContain("trailer");
    expect(artifactType("video_description").label).toBe("Video Description");
  });
});
