import { describe, expect, it } from "vitest";
import { slideTexts } from "./carousel-slides";

describe("slideTexts", () => {
  it("reads the Text: line of each ### Slide section, including Devanagari", () => {
    const c = "# Monsoon\n\n### Slide 1\n**Text:** बारिश की पहली बूँद\n**Visual:** a window with rain\n\n### Slide 2\n**Text:** \"Chai, again\"\n**Visual:** steam";
    expect(slideTexts(c)).toEqual(["बारिश की पहली बूँद", "Chai, again"]);
  });

  it("takes an inline heading line when there's no Text: label", () => {
    expect(slideTexts("**Slide 1:** Begin small\n\nSlide 2 — Keep going\n- Visual: road")).toEqual(["Begin small", "Keep going"]);
  });

  it("falls back to the first plain lines and skips notes", () => {
    expect(slideTexts("## Slide 1\nNotes: bold type\nThe sea remembers\nevery name")).toEqual(["The sea remembers\nevery name"]);
  });

  it("orders by slide number and returns nothing without slides", () => {
    expect(slideTexts("Slide 2: two\nSlide 1: one")).toEqual(["one", "two"]);
    expect(slideTexts("Just a poem\nwith lines")).toEqual([]);
  });
});
