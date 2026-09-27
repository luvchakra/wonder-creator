import { expect, saveNote, test, uid } from "./fixtures";

test.describe("Home Canvas", () => {
  test("begins calmly, then centres on the Creation in progress with one honest CreativeMind moment", async ({ page, creator }) => {
    void creator;
    // New creator: an editorial start, no chat box, no dashboard sections.
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "What would you like to begin with?" })).toBeVisible();
    await expect(page.getByLabel("What are you thinking about?")).toHaveCount(0);
    // The supplied artwork: one decorative floral corner, and the watercolor motif on the Palette trigger — both hidden
    // from assistive tech (the trigger keeps its own name).
    await expect(page.locator('main img[src*="/brand/watercolor/floral-corner"]')).toHaveAttribute("aria-hidden", "true");
    await expect(page.getByRole("button", { name: "Open Creative Palette" }).locator('img[src*="/brand/watercolor/watercolor-paint-palette"]')).toHaveAttribute("alt", "");
    await page.getByRole("button", { name: "meTalk" }).click();
    await expect(page.getByRole("dialog", { name: "meTalk" })).toBeVisible();
    await page.keyboard.press("Escape");

    // A Creation in progress becomes the Canvas; new material since then is noticed plainly.
    const title = `Harbour lights ${uid()}`;
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title } })).json()).artifact as { id: string };
    await saveNote(page, `Night ferry sounds ${uid()}`);
    await page.goto("/");
    const hero = page.getByRole("link", { name: `Continue ${title}` });
    await expect(hero).toContainText("Poem · In Progress");
    const noticed = page.getByRole("region", { name: "Wonder noticed" });
    await expect(noticed).toContainText("1 new material since you last worked on");
    await expect(page.getByRole("region", { name: "CreativeMind insight" })).toHaveCount(0); // nothing CreativeMind didn't say
    await expect(page.getByRole("heading", { name: "Recent Materials" })).toBeVisible();
    await hero.click();
    await expect(page).toHaveURL(new RegExp(`/artifacts/${art.id}$`));
  });
});
