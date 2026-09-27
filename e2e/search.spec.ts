import { expect, saveNote, test, uid } from "./fixtures";

test.describe("Unified search", () => {
  test.beforeEach(({ creator }) => void creator);

  test("search across material and collections, filter by tab, tag and date, and ask CreativeMind about the results", async ({ page }) => {
    const word = `zephyr${uid()}`;
    const tagged = `${word} tide pools at dawn`;
    const plain = `${word} market lanterns`;
    const taggedId = await saveNote(page, tagged);
    await saveNote(page, plain);
    const tag = `coast${uid()}`.slice(0, 20);
    expect((await page.request.patch(`/api/v1/materials/${taggedId}`, { data: { tags: [tag] } })).ok()).toBe(true);
    expect((await page.request.post("/api/v1/collections", { data: { name: `${word} moodboard` } })).ok()).toBe(true);

    // The quick search dialog leads to the full results page.
    await page.getByRole("button", { name: "Search your creativity" }).click();
    await page.getByRole("dialog", { name: "Search" }).getByLabel("Search").fill(word);
    await page.getByRole("link", { name: "See all results and filters" }).click();
    await expect(page).toHaveURL(new RegExp(`/search\\?q=${word}`));

    const material = page.getByRole("region", { name: "Your material" });
    await expect(material.getByRole("link").filter({ hasText: "tide pools" })).toBeVisible();
    await expect(material.getByRole("link").filter({ hasText: "market lanterns" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Collections" }).getByRole("link", { name: new RegExp(`${word} moodboard`) })).toBeVisible();

    // Tabs keep the query; a tab shows only its entity.
    await page.getByRole("navigation", { name: "Search in" }).getByRole("link", { name: "Collections" }).click();
    await expect(page).toHaveURL(new RegExp(`type=collections`));
    await expect(page.getByLabel("Search", { exact: true })).toHaveValue(word);
    await expect(page.getByRole("region", { name: "Your material" })).toHaveCount(0);
    await page.getByRole("navigation", { name: "Search in" }).getByRole("link", { name: "Material" }).click();
    await expect(page).toHaveURL(/type=material/);

    // A tag narrows to tagged material; the filter survives a new query and a reload.
    await page.getByRole("navigation", { name: "Tags" }).getByRole("link", { name: `#${tag}` }).click();
    await expect(page).toHaveURL(/tag=/);
    await expect(material.getByRole("link").filter({ hasText: "tide pools" })).toBeVisible();
    await expect(material.getByRole("link").filter({ hasText: "market lanterns" })).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("navigation", { name: "Tags" }).getByRole("link", { name: `#${tag}` })).toHaveAttribute("aria-current", "true");
    await page.getByRole("navigation", { name: "Tags" }).getByRole("link", { name: `#${tag}` }).click();
    await expect(page).not.toHaveURL(/tag=/);

    // Date filter: everything here is from today.
    await page.getByRole("navigation", { name: "When" }).getByRole("link", { name: "Past day" }).click();
    await expect(page).toHaveURL(/when=day/);
    await expect(material.getByRole("link").filter({ hasText: "market lanterns" })).toBeVisible();

    // Ask CreatorBrain about the result set: CreatorTalk opens with those pieces attached.
    await page.getByRole("link", { name: "Ask CreativeMind about these" }).click();
    await expect(page).toHaveURL(/\/create\?materials=/);
    const talk = page.getByRole("region", { name: "meTalk" });
    await expect(talk.getByText(tagged)).toBeVisible();
    await expect(talk.getByText(plain)).toBeVisible();
  });

  test("an empty search explains itself and nothing is searched", async ({ page }) => {
    await page.goto("/search");
    await expect(page.getByRole("heading", { name: "Search your creative world" })).toBeVisible();
    await page.goto(`/search?q=${uid()}nothing`);
    await expect(page.getByRole("heading", { name: /Nothing found for/ })).toBeVisible();
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/search\?q=/);
  });
});
