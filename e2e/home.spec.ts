import { adminPatch, expect, saveNote, test, uid } from "./fixtures";

test.describe("Home Canvas", () => {
  test("begins calmly, then centres on the Creation in progress with one clear focus", async ({ page, creator }) => {
    void creator;
    // New creator: an editorial start, no chat box, no dashboard sections.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What would you like to begin with?" })).toBeVisible();
    await expect(page.getByLabel("What are you thinking about?")).toHaveCount(0);
    // The supplied artwork: one decorative floral corner, and the watercolor motif on the Palette trigger — both hidden
    // from assistive tech (the trigger keeps its own name).
    await expect(page.locator('main img[src*="/brand/watercolor/floral-corner"]')).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByRole("button", { name: "Open Creative Palette" }).locator('img[src*="/brand/kit/palette-button-master"]')).toHaveAttribute("alt", "");
    // One primary way to begin and one secondary (interaction minimalism); the rest is in the Palette.
    const begin = page.getByRole("region", { name: "What would you like to begin with?" });
    await expect(begin.getByRole("link")).toHaveText([/New Creation/, /Bring Material/]);

    // Creations in progress show as thin Continue rows (the last three edited), then "All my creations".
    const title = `Harbour lights ${uid()}`;
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title } })).json()).artifact as { id: string };
    await saveNote(page, `Night ferry sounds ${uid()}`);
    await page.goto("/");
    const rows = page.getByRole("list", { name: "Creations in progress" });
    await expect(rows.getByRole("link", { name: new RegExp(title) })).toContainText(/Poem · Edited (just now|\d+ min ago)/);
    await expect(rows.getByRole("link", { name: "All my creations" })).toHaveAttribute("href", "/creations");
    // Sections only appear with something real in them: nothing happened, no one's waiting, nothing old to rediscover.
    for (const name of ["While you were away", "A little spark", "You could help"]) await expect(page.getByRole("region", { name })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Recent Materials" })).toHaveCount(0);
    // Continue lands in the Creative Studio (the boards' default view), not on the Creation page.
    await rows.getByRole("link", { name: new RegExp(title) }).click();
    await expect(page).toHaveURL(new RegExp(`/creations/${art.id}/studio$`));
  });

  test("Continue shows the last three Creations in progress as thin rows, then All my creations", async ({ page, creator }) => {
    void creator;
    const tag = uid();
    const make = async (title: string) => ((await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title } })).json()).artifact as { id: string }).id;
    await make(`Oldest ${tag}`);
    for (const n of ["Second", "Third"]) await make(`${n} ${tag}`);
    const done = await make(`Finished ${tag}`);
    await adminPatch("artifacts", `id=eq.${done}`, { status: "final" });
    await make(`Newest ${tag}`);
    await page.goto("/");
    const rows = page.getByRole("list", { name: "Creations in progress" });
    // Newest first; a finished Creation and the fourth-newest draft don't take a row.
    await expect(rows.getByRole("link")).toHaveText([new RegExp(`Newest ${tag}`), new RegExp(`Third ${tag}`), new RegExp(`Second ${tag}`), "All my creations"]);
    await expect(page.locator("[data-primary-action]")).toHaveCount(1);
    await expect(page.getByRole("link", { name: "Continue Creating" })).toHaveCount(0);
  });
});
