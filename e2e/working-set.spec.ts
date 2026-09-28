import { expect, saveNote, test, uid } from "./fixtures";

test.describe("CreativeStudio Working Set", () => {
  test.beforeEach(({ creator }) => void creator);

  test("bring in, use, pin — without leaving the Studio, and it's all still there after a reload", async ({ page }) => {
    const tag = uid();
    await saveNote(page, `Dad waited at Platform 3 every Sunday ${tag}`);
    const title = `Platform 3 ${tag}`;
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title } })).json()).artifact as { id: string };
    await page.goto(`/artifacts/${art.id}/studio`);
    await expect(page.getByRole("region", { name: "Editor" })).toBeVisible();

    // One compact affordance; an empty table says so with one action.
    await page.getByRole("button", { name: /^Working Set: No sources yet/ }).click();
    const sheet = page.getByRole("dialog", { name: "Working Set" });
    await expect(sheet.getByText("Nothing here yet.")).toBeVisible();
    await sheet.getByRole("button", { name: "Bring in" }).click();

    // Search across what you have, pick, add.
    const bring = page.getByRole("dialog", { name: "Bring in" });
    await bring.getByPlaceholder("Search Materials, Creations, Collections…").fill(tag);
    const materials = bring.getByRole("region", { name: "Materials" });
    await materials.getByRole("checkbox").first().click();
    await bring.getByRole("button", { name: "Add to Studio (1)" }).click();

    // It lands Available; a tap puts it In use; Pin keeps it as it is.
    const set = page.getByRole("dialog", { name: "Working Set" });
    const available = set.getByRole("region", { name: "Available" });
    const row = available.getByRole("switch").first();
    await expect(row).toHaveAttribute("aria-checked", "false");
    await row.click();
    const inUse = set.getByRole("region", { name: "In use" });
    await expect(inUse.getByRole("switch")).toHaveAttribute("aria-checked", "true");
    await inUse.getByRole("button", { name: /^More for / }).click();
    await page.getByRole("menuitem", { name: /Pin/ }).click();
    await expect(set.getByRole("region", { name: "Pinned" }).getByRole("switch")).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: /^Working Set: 1 source · 1 pinned/ })).toBeVisible();
    // No new version for any of it.
    const versions = await (await page.request.get(`/api/v1/artifacts/${art.id}/versions`)).json();
    expect(versions.versions).toHaveLength(1);
  });
});
