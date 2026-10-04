import { describe, expect, it } from "vitest";
import { creationPath, hasOwnPage, lookOf } from "./creation-pages";

describe("creation pages", () => {
  it("opens writing on its own page and the rest in the Studio", () => {
    expect(creationPath("a1", "story")).toBe("/creations/a1/write");
    expect(creationPath("a1", "poem")).toBe("/creations/a1/write");
    expect(creationPath("a1", "screenplay")).toBe("/creations/a1/write");
    expect(creationPath("a1", "carousel")).toBe("/creations/a1/studio");
    expect(creationPath("a1", "short_film")).toBe("/creations/a1/studio");
    expect(hasOwnPage("essay")).toBe(true);
    expect(hasOwnPage("presentation")).toBe(false);
  });

  it("sets the words on paper without a cover, else as chosen (over the cover by default)", () => {
    expect(lookOf({ look: "blur" }, false)).toBe("paper");
    expect(lookOf({}, true)).toBe("cover");
    expect(lookOf(null, true)).toBe("cover");
    expect(lookOf({ look: "blur" }, true)).toBe("blur");
    expect(lookOf({ look: "paper" }, true)).toBe("paper");
    expect(lookOf({ look: "neon" }, true)).toBe("cover");
  });
});
