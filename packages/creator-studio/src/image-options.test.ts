import { describe, expect, it } from "vitest";
import { DEFAULT_EDITS, applyPixelOps, aspectRatioOf, cssFilter, imageSetOf, pixelOps } from "./image-options";

describe("Images page model", () => {
  it("reads a version's pictures tolerantly: defaults for what's missing, nothing for what isn't a picture", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const set = imageSetOf({ kind: "images", items: [{ materialId: id, edits: { filter: "warm", zoom: 9 } }, { materialId: "nope" }, { caption: "x" }] });
    expect(set.items).toHaveLength(1);
    expect(set.items[0]).toMatchObject({ materialId: id, caption: "", edits: DEFAULT_EDITS, words: { enabled: false } });
    expect(imageSetOf(null).items).toEqual([]);
    expect(imageSetOf({ kind: "other" }).items).toEqual([]);
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
