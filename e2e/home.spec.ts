import { expect, saveNote, test, uid } from "./fixtures";

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

    // A Creation in progress becomes the one clear focus, with its version, type and last edit.
    const title = `Harbour lights ${uid()}`;
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title } })).json()).artifact as { id: string };
    await saveNote(page, `Night ferry sounds ${uid()}`);
    await page.goto("/");
    const hero = page.getByRole("region", { name: title });
    await expect(hero).toContainText(/v1 · Poem · Edited (just now|\d+ min ago)/);
    // Sections only appear with something real in them: nothing happened, no one's waiting, nothing old to rediscover.
    for (const name of ["While you were away", "A little spark", "Worth hearing", "You could help"]) await expect(page.getByRole("region", { name })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Recent Materials" })).toHaveCount(0);
    // Continue lands in the Creative Studio (the boards' default view), not on the Creation page.
    await hero.getByRole("link", { name: /Continue Creating/ }).click();
    await expect(page).toHaveURL(new RegExp(`/creations/${art.id}/studio$`));
  });
});
