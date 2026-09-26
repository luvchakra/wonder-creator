import { describe, expect, it } from "vitest";
import { exportFormatsFor, exportNote, renderExport } from "./exports";

const src = { title: "Harbour <Lamps>", artifactType: "poem", versionNumber: 2, createdAt: "2026-09-26T10:00:00Z", content: "One & two <script>x</script>" };

describe("exports", () => {
  it("offers formats that suit the kind of piece", () => {
    expect(exportFormatsFor("poem")).toEqual(["md", "txt", "html"]);
    expect(exportFormatsFor("screenplay")[0]).toBe("fountain");
    expect(exportNote("poem")).toBeNull();
  });

  it("renders each format, escaping HTML", () => {
    expect(renderExport("md", src).body).toContain("# Harbour <Lamps>\n\n*Poem · v2 · 2026-09-26*");
    expect(renderExport("txt", src).filename).toBe("harbour-lamps.txt");
    const html = renderExport("html", src).body;
    expect(html).toContain("&lt;script&gt;x&lt;/script&gt;");
    expect(html).not.toContain("<script>x");
    expect(renderExport("fountain", { ...src, artifactType: "screenplay", byline: "Asha" }).body).toMatch(/^Title: Harbour <Lamps>\nAuthor: Asha\n/);
  });
});
