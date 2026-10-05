import { describe, expect, it } from "vitest";
import { blankSlide, deckOf, deckText, MAX_SLIDES } from "./deck-options";

describe("Presentation decks", () => {
  it("read a saved deck as it is", () => {
    const deck = { kind: "deck", theme: "cinematic", slides: [{ id: "s1abc", title: "Hello", body: "World", notes: "Smile" }] };
    expect(deckOf(deck)).toEqual(deck);
  });

  it("open an outline as slides: headings, Slide N lines and rules each start one", () => {
    const outline = ["Platform 3", "A talk about waiting", "", "## Why trains", "- They wait for no one", "", "**Slide 3: The father**", "Coat folded.", "---", "Thank you"].join("\n");
    const d = deckOf(null, outline);
    expect(d.theme).toBe("paper");
    expect(d.slides.map((s) => [s.title, s.body])).toEqual([
      ["Platform 3", "A talk about waiting"],
      ["Why trains", "- They wait for no one"],
      ["The father", "Coat folded."],
      ["Thank you", ""],
    ]);
    expect(new Set(d.slides.map((s) => s.id)).size).toBe(4);
  });

  it("never throws on junk, and keeps a known theme from a broken deck", () => {
    expect(deckOf({ kind: "deck", theme: "gradient", slides: "nope" }, "")).toEqual({ kind: "deck", theme: "gradient", slides: [] });
    expect(deckOf(42, "").slides).toEqual([]);
    expect(deckOf(null, "x\n".repeat(10) + "## a\n".repeat(MAX_SLIDES + 5)).slides.length).toBe(MAX_SLIDES);
  });

  it("writes the words as headings and text, never the speaker notes", () => {
    const d = { kind: "deck" as const, theme: "paper" as const, slides: [{ ...blankSlide("Opening"), body: "Hello", notes: "secret" }, blankSlide("")] };
    expect(deckText(d)).toBe("## Opening\n\nHello\n\n## Slide 2");
  });
});
