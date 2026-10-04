import { describe, expect, it } from "vitest";
import { DEFAULT_EDITS, applyPixelOps, aspectRatioOf, cssFilter, imageSetOf, pixelOps, textsOf } from "./image-options";

describe("Images page model", () => {
  it("reads a version's pictures tolerantly: defaults for what's missing, nothing for what isn't a picture", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const set = imageSetOf({ kind: "images", items: [{ materialId: id, edits: { filter: "warm", zoom: 9 } }, { materialId: "nope" }, { caption: "x" }] });
    expect(set.items).toHaveLength(1);
    expect(set.items[0]).toMatchObject({ materialId: id, caption: "", edits: DEFAULT_EDITS, texts: [] });
    expect(imageSetOf(null).items).toEqual([]);
    expect(imageSetOf({ kind: "other" }).items).toEqual([]);
  });

  it("reads text boxes, and the older single overlay as one box; junk boxes are dropped", () => {
    const boxes = textsOf({ texts: [{ id: "a", text: "Dawn", x: 0.5, y: 0.2 }, { text: 42 }, { id: "b", text: "Dusk", size: 9 }] });
    expect(boxes.map((b) => [b.id, b.text, b.y])).toEqual([["a", "Dawn", 0.2]]);
    expect(textsOf({ words: { enabled: true, text: "The harbour", y: 0.8 } })).toMatchObject([{ text: "The harbour", y: 0.8, font: "serif" }]);
    expect(textsOf({ words: { enabled: false, text: "Hidden" } })).toEqual([]);
    expect(textsOf(null)).toEqual([]);
    expect(imageSetOf({ kind: "images", items: [{ materialId: "11111111-1111-4111-8111-111111111111", words: { enabled: true, text: "Old shape" } }] }).items[0]!.texts).toHaveLength(1);
  });

  it("maps filters and light to pixel ops and a matching CSS filter", () => {
    expect(pixelOps({ filter: "none", brightness: 1, contrast: 1 })).toMatchObject({ brightness: 1, contrast: 1, saturate: 1 });
    expect(pixelOps({ filter: "mono", brightness: 1, contrast: 1 }).saturate).toBe(0);
    expect(cssFilter({ filter: "warm", brightness: 1.1, contrast: 1 })).toMatch(/sepia/);
    const px = new Uint8ClampedArray([200, 100, 50, 255]);
    applyPixelOps(px, pixelOps({ filter: "mono", brightness: 1, contrast: 1 }));
    expect(px[0]).toBe(px[1]);
    expect(px[1]).toBe(px[2]);
  });

  it("gives each crop its shape, following the picture when free", () => {
    expect(aspectRatioOf("1:1")).toBe(1);
    expect(aspectRatioOf("16:9")).toBeCloseTo(16 / 9);
    expect(aspectRatioOf("original", { width: 300, height: 200 })).toBe(1.5);
  });
});
