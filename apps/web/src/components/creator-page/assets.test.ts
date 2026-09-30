import { existsSync } from "node:fs";
import { join } from "node:path";
import { TEMPLATE_IDS } from "@wonder/creator-studio/creator-page";
import { describe, expect, it } from "vitest";
import { CREATOR_PAGE_ASSETS, TEMPLATE_THUMB } from "./assets";

const pub = join(__dirname, "../../../public");
const files = (a: object) => ("svg" in a ? [(a as { svg: string }).svg] : [...(a as { webp: Array<{ src: string }> }).webp.map((x) => x.src), ...(a as { avif: Array<{ src: string }> }).avif.map((x) => x.src)]);

describe("Creator Page asset registry", () => {
  it("resolves every key to real published files", () => {
    for (const [k, a] of Object.entries(CREATOR_PAGE_ASSETS)) {
      const fs = files(a);
      expect(fs.length, k).toBeGreaterThan(0);
      for (const f of fs) expect(existsSync(join(pub, f)), `${k}: ${f}`).toBe(true);
    }
  });

  it("has a picker thumbnail for every template", () => {
    for (const id of TEMPLATE_IDS) expect(TEMPLATE_THUMB[id]).toBeTruthy();
  });
});
