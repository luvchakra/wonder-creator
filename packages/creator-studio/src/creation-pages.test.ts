import { describe, expect, it } from "vitest";
import { WRITING_KINDS, creationPath, hasOwnPage, isSceneBreak, lookOf, writingStyleOf } from "./creation-pages";
import { isKnownArtifactType } from "./artifact-types";
import { outputModeOf } from "./working-set-options";

describe("creation pages", () => {
  it("opens writing on its own page and the rest in the Studio", () => {
    expect(creationPath("a1", "story")).toBe("/creations/a1/write");
    expect(creationPath("a1", "poem")).toBe("/creations/a1/write");
    expect(creationPath("a1", "screenplay")).toBe("/creations/a1/write");
    expect(creationPath("a1", "carousel")).toBe("/creations/a1/studio");
    expect(creationPath("a1", "short_film")).toBe("/creations/a1/video");
    expect(creationPath("a1", "storyboard")).toBe("/creations/a1/video");
    expect(hasOwnPage("essay")).toBe(true);
    expect(hasOwnPage("presentation")).toBe(true);
    expect(creationPath("a1", "presentation")).toBe("/creations/a1/deck");
    expect(creationPath("a1", "pitch_deck")).toBe("/creations/a1/deck");
  });

  it("sets the words on paper without a cover, else as chosen (over the cover by default)", () => {
    expect(lookOf({ look: "blur" }, false)).toBe("paper");
    expect(lookOf({}, true)).toBe("cover");
    expect(lookOf(null, true)).toBe("cover");
    expect(lookOf({ look: "blur" }, true)).toBe("blur");
    expect(lookOf({ look: "paper" }, true)).toBe("paper");
    expect(lookOf({ look: "neon" }, true)).toBe("cover");
  });

  it("sets each kind after the publications that set it best", () => {
    expect(writingStyleOf("poem")).toBe("verse");
    expect(writingStyleOf("essay")).toBe("essay");
    expect(writingStyleOf("article")).toBe("feature");
    expect(writingStyleOf("news")).toBe("news");
    expect(writingStyleOf("prose")).toBe("fiction");
    expect(writingStyleOf("letter")).toBe("letter");
    expect(writingStyleOf("screenplay")).toBe("script");
    for (const k of WRITING_KINDS) {
      expect(isKnownArtifactType(k.type)).toBe(true);
      expect(outputModeOf(k.type)).toBe("writing");
    }
    expect(["***", "* * *", "⁂", "#"].every(isSceneBreak)).toBe(true);
    expect(isSceneBreak("A sentence.")).toBe(false);
  });
});
