import { describe, expect, it } from "vitest";
import { craftOf, syllablesOf } from "./writing-craft";

describe("Writing craft view", () => {
  it("verse: lines, stanza shape and syllables per line (words for other scripts)", () => {
    const v = craftOf("verse", "Tide", "The tide keeps our names\nlantern on the jetty\n\nWe walked out at dawn\nthe water was gold");
    expect(v.facts.find((f) => f.label === "Lines")?.value).toBe("4");
    expect(v.facts.find((f) => f.label === "Stanzas")?.value).toBe("2 stanzas of 2 lines");
    expect(v.lines?.[0]).toMatchObject({ unit: "syllables" });
    expect(v.lines?.[0].count).toBeGreaterThanOrEqual(5);
    const hindi = craftOf("verse", "", "अनुभव करने को\nबहुत सारा बाक़ी है");
    expect(hindi.lines?.[1]).toMatchObject({ unit: "words", count: 4 });
  });

  it("news: headline length and a long lede noted, never scored", () => {
    const lede = Array.from({ length: 40 }, () => "word").join(" ");
    const v = craftOf("news", "Harbour lights return", `${lede}\n\nMore.`);
    expect(v.facts[0].value).toMatch(/^21 characters/);
    expect(v.facts[1].note).toMatch(/35 words/);
  });

  it("script: scene headings and about a minute a page", () => {
    const v = craftOf("script", "", "INT. STATION — NIGHT\nShe waits.\n\nEXT. PLATFORM 3 — DAWN\nThe train.");
    expect(v.facts[0].value).toBe("2");
  });

  it("estimates syllables", () => {
    expect(syllablesOf("lantern")).toBe(2);
    expect(syllablesOf("the")).toBe(1);
    expect(syllablesOf("water")).toBe(2);
  });
});
