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
    // The Scrapbook above ends the same way: its last row opens all scraps.
    await page.getByRole("region", { name: "My Scrapbook" }).getByRole("link", { name: "All scraps" }).click();
    await expect(page).toHaveURL(/\/scrapbook$/);
  });

  test("My Scrapbook rows open in place, one at a time, and collapse; My Testimonials is always there", async ({ page, creator }) => {
    void creator;
    const tag = uid();
    for (const body of [`First scrap ${tag}`, `Second scrap ${tag}. A longer thought that would be cut short in the row but reads whole once opened.`]) {
      expect((await page.request.post("/api/v1/scrapbook", { data: { kind: "thought", body } })).ok()).toBe(true);
    }
    await page.goto("/");
    const rows = page.getByRole("region", { name: "My Scrapbook" }).getByRole("list", { name: "Last written in the Scrapbook" });
    const second = rows.getByRole("button", { name: new RegExp(`Second scrap ${tag}`) });
    const first = rows.getByRole("button", { name: new RegExp(`First scrap ${tag}`) });
    await expect(second).toHaveAttribute("aria-expanded", "false");
    await second.click();
    await expect(second).toHaveAttribute("aria-expanded", "true");
    await expect(rows.locator("[id^=scrap-]").getByText(/reads whole once opened/)).toBeVisible();
    await expect(rows.getByRole("link", { name: /Open and reply/ })).toBeVisible();
    // Opening another closes the first; Collapse closes everything.
    await first.click();
    await expect(first).toHaveAttribute("aria-expanded", "true");
    await expect(rows.getByRole("button", { expanded: true })).toHaveCount(1);
    await page.getByRole("region", { name: "My Scrapbook" }).getByRole("button", { name: "Collapse" }).click();
    await expect(rows.getByRole("button", { expanded: true })).toHaveCount(0);
    // Fixed sections, each once.
    for (const name of ["My Scrapbook", "My Communities", "My Testimonials"]) await expect(page.getByRole("region", { name })).toHaveCount(1);
    await expect(page.getByRole("region", { name: "My Testimonials" })).toContainText("Nobody has written one yet");
  });
});
