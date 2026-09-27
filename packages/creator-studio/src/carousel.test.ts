import { describe, expect, it } from "vitest";
import { alternativeChunks, authoredSlides, chunkText, cleanSource, cropRect, snapPosition, splitChunk } from "./carousel";

const poem = `चाँद घटते-घटते
अमावस की जेब में जा छुपा है,

और आईने के सामने देखो तो—
बस एक तन्हाई है

धुँधली रोशनी में
चेहरा भी जैसे कोई सवाल है,

कुछ बातें हैं
जो कहे बिना ही रह जाती हैं,

फिर भी भीतर कहीं एक रोशनी है—
जो अब भी बाक़ी है।`;

describe("chunkText", () => {
  it("gives one stanza per slide when the counts match, keeping poetic line breaks", () => {
    const c = chunkText(poem, 5);
    expect(c).toHaveLength(5);
    expect(c[0]).toBe("चाँद घटते-घटते\nअमावस की जेब में जा छुपा है,");
    expect(c[1]).toBe("और आईने के सामने देखो तो—\nबस एक तन्हाई है");
  });

  it("groups stanzas for fewer slides and splits at lines for more, never losing or reordering words", () => {
    for (const n of [2, 3, 6, 8]) {
      const c = chunkText(poem, n);
      expect(c).toHaveLength(n);
      expect(c.join("\n").replace(/\s+/g, " ")).toBe(cleanSource(poem).flat().join(" ").replace(/\s+/g, " "));
    }
    // Three slides from five stanzas: breaks land between stanzas.
    const three = chunkText(poem, 3);
    expect(three.every((s) => !s.startsWith("अमावस") && !s.startsWith("बस एक"))).toBe(true);
  });

  it("splits a single paragraph at sentences, and returns fewer chunks when there aren't enough words", () => {
    expect(chunkText("The sea keeps our names. The lamps remember. We come home.", 3)).toEqual(["The sea keeps our names.", "The lamps remember.", "We come home."]);
    expect(chunkText("Hello", 4)).toEqual(["Hello"]);
  });

  it("uses slides the writer already marked, and drops design notes and Markdown", () => {
    const authored = "### Slide 1\n**Text:** Begin small\n**Visual:** a seed\n\n### Slide 2\n**Text:** Keep going";
    expect(authoredSlides(authored)).toEqual(["Begin small", "Keep going"]);
    expect(chunkText(authored, 2)).toEqual(["Begin small", "Keep going"]);
    expect(cleanSource("# Title\n- **bold** line\nVisual: a road")).toEqual([["Title", "bold line"]]);
  });
});

describe("alternativeChunks / splitChunk", () => {
  it("offers different chunks for a slide, never the current one", () => {
    const current = chunkText(poem, 5)[1]!;
    const alts = alternativeChunks(poem, 5, 1, current);
    expect(alts.length).toBeGreaterThan(1);
    expect(alts).not.toContain(current);
  });

  it("splits at the line nearest the middle, else at a sentence or word", () => {
    expect(splitChunk("one line here,\nsecond line.\nthird\nfourth")).toEqual(["one line here,\nsecond line.", "third\nfourth"]);
    expect(splitChunk("First part. Second part.")).toEqual(["First part.", "Second part."]);
    expect(splitChunk("alpha beta gamma delta")).toEqual(["alpha beta", "gamma delta"]);
    expect(splitChunk("single")).toBeNull();
  });
});

describe("overlay geometry", () => {
  it("snaps near safe points and keeps text inside the margin", () => {
    expect(snapPosition(0.51, 0.83)).toMatchObject({ x: 0.5, y: 0.84, snapped: "Bottom centre" });
    expect(snapPosition(0.99, 0.01)).toEqual({ x: 0.94, y: 0.06, snapped: null });
  });

  it("crops around the focal point without leaving the image", () => {
    expect(cropRect(1000, 1000, { zoom: 2, focalX: 0.5, focalY: 0.5 })).toEqual({ sx: 250, sy: 250, sw: 500, sh: 500 });
    expect(cropRect(1000, 1000, { zoom: 2, focalX: 1, focalY: 0 })).toEqual({ sx: 500, sy: 0, sw: 500, sh: 500 });
    expect(cropRect(1000, 800, { zoom: 1, focalX: 0.2, focalY: 0.9 })).toEqual({ sx: 0, sy: 0, sw: 1000, sh: 800 });
  });
});
