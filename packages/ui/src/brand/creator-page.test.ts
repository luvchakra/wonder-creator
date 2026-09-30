import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CREATOR_PAGE_DECORATIONS, CREATOR_PAGE_TEMPLATES } from "./creator-page";

const pub = join(__dirname, "../../../../apps/web/public");

describe("Creator Page background library", () => {
  it("has the board's five templates (with swatches and renders) and twelve decorations", () => {
    expect(Object.keys(CREATOR_PAGE_TEMPLATES)).toEqual(["immersiveHero", "editorialPaper", "cinematicDark", "creativeCollage", "softGradient", "immersiveHeroWide"]);
    expect(Object.keys(CREATOR_PAGE_DECORATIONS)).toHaveLength(12);
    for (const t of Object.values(CREATOR_PAGE_TEMPLATES)) {
      expect(t.palette).toHaveLength(5);
      expect(t.image.webp.at(-1)!.width).toBeGreaterThanOrEqual(1440);
    }
  });

  it("every published file exists and every SVG is safe to serve", () => {
    const files = [...Object.values(CREATOR_PAGE_TEMPLATES).flatMap((t) => [t.vector.svg, ...t.image.avif.map((x) => x.src), ...t.image.webp.map((x) => x.src)]), ...Object.values(CREATOR_PAGE_DECORATIONS).map((d) => d.vector.svg)];
    for (const f of files) expect(existsSync(join(pub, f)), f).toBe(true);
    for (const f of files.filter((x) => x.endsWith(".svg"))) expect(readFileSync(join(pub, f), "utf8")).not.toMatch(/<script|\son[a-z]+=|javascript:|<foreignObject|href="http/i);
  });
});
