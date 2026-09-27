import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { expect, saveNote, test, uid, type Page } from "./fixtures";

const axeSource = readFileSync(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

type Violation = { id: string; impact: string | null; help: string; nodes: Array<{ target: string[] }> };

/** Serious and critical WCAG 2.x A/AA problems on the current page. */
async function seriousViolations(page: Page): Promise<string[]> {
  await page.addScriptTag({ content: axeSource });
  const violations = (await page.evaluate(async () => {
    const r = await (window as unknown as { axe: { run: (ctx: unknown, opts: unknown) => Promise<{ violations: unknown[] }> } }).axe.run(document, {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return r.violations;
  })) as Violation[];
  return violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} (${v.impact}): ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

test.describe("accessibility", () => {
  test("key screens have no serious or critical WCAG A/AA violations", async ({ page, creator }) => {
    void creator;
    test.setTimeout(180_000);
    const res = await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title: `Accessible tide ${uid()}` } });
    const art = (await res.json()).artifact as { id: string };
    const material = `/space/materials/${await saveNote(page, `A note ${uid()}`)}`;
    const project = `/projects/${((await (await page.request.post("/api/v1/projects", { data: { title: `Accessible project ${uid()}`, brief: "Tides." } })).json()) as { project: { id: string } }).project.id}`;
    const crew = `/crews/${((await (await page.request.post(`/api/v1${project}/crew`, { data: {} })).json()) as { crew: { id: string } }).crew.id}`;
    const routes = [
      "/",
      "/create",
      "/space",
      material,
      `/artifacts/${art.id}`,
      `/artifacts/${art.id}/studio`,
      `/artifacts/${art.id}/context`,
      `/artifacts/${art.id}/context?tab=related`,
      `/artifacts/${art.id}/share`,
      `/artifacts/${art.id}/publish`,
      `/artifacts/${art.id}/derivatives`,
      `/artifacts/${art.id}/collaborate`,
      "/approvals",
      "/huddles",
      "/scrapbook",
      "/projects",
      project,
      `${project}?tab=work`,
      `${project}?tab=chat`,
      `${project}?tab=tasks`,
      `${project}?tab=contributions`,
      `${project}?tab=rights`,
      `${project}/complete`,
      `/discover?project=${project.split("/").pop()}&terms=writing`,
      crew,
      "/search?q=tide",
      "/messages",
      "/publishing",
      "/settings",
      "/settings/ai",
      "/settings/audit",
      "/shared",
    ];
    const problems: string[] = [];
    for (const path of routes) {
      await page.goto(path);
      await page.waitForLoadState("load");
      await page.getByRole("main").waitFor();
      await page.waitForTimeout(500);
      for (const v of await seriousViolations(page)) problems.push(`${path}: ${v}`);
    }
    expect(problems, problems.join("\n")).toEqual([]);
  });
});
