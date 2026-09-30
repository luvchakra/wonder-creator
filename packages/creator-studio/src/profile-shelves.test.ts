import { describe, expect, it } from "vitest";
import { profileShelf, readingMinutes } from "./artifact-types";

describe("Profile Creations filters", () => {
  it("puts each piece under one filter: multi-part visual stories are Series, other social pieces are Writing", () => {
    expect(profileShelf("carousel")).toBe("series");
    expect(profileShelf("photo_essay")).toBe("series");
    expect(profileShelf("poem")).toBe("writing");
    expect(profileShelf("social_post")).toBe("writing");
    expect(profileShelf("poster")).toBe("visual");
    expect(profileShelf("narration")).toBe("audio");
    expect(profileShelf("short_film")).toBe("video");
    expect(profileShelf("something_new")).toBe("writing");
  });

  it("estimates reading time quietly, and never for empty text", () => {
    expect(readingMinutes("")).toBeNull();
    expect(readingMinutes(null)).toBeNull();
    expect(readingMinutes("A short poem.")).toBe(1);
    expect(readingMinutes(Array(660).fill("word").join(" "))).toBe(3);
  });
});
