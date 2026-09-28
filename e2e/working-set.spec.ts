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

    // One doorway: kinds of source, then search across them, pick several, add.
    const bring = page.getByRole("dialog", { name: "Bring in" });
    await expect(bring.getByRole("list", { name: "Kinds of source" }).getByRole("button")).toHaveCount(8);
    await bring.getByPlaceholder("Search materials, creations, people, web…").fill(tag);
    const materials = bring.getByRole("region", { name: "Materials" });
    await materials.getByRole("checkbox").first().click();
    await expect(bring.getByText("1 selected")).toBeVisible();
    await bring.getByRole("button", { name: "Add to Studio" }).click();

    // It lands Available; a tap puts it In use; Pin keeps it as it is.
    const set = page.getByRole("dialog", { name: "Working Set" });
    const row = set.getByRole("switch").first();
    await expect(row).toHaveAttribute("aria-checked", "false");
    await row.click();
    await expect(row).toHaveAttribute("aria-checked", "true");
    await set.getByRole("button", { name: /^Pin / }).click();
    await expect(set.getByRole("radio", { name: /Pinned/ })).toContainText("1");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /^Working Set: 1 source · 1 in use/ })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: /^Working Set: 1 source · 1 in use/ })).toBeVisible();
    // No new version for any of it.
    const versions = await (await page.request.get(`/api/v1/artifacts/${art.id}/versions`)).json();
    expect(versions.versions).toHaveLength(1);
  });

  test("select two sources → Use together → an idea to use; a comment can be used in the Studio; the format switch keeps the ingredients", async ({ page }) => {
    const tag = uid();
    const n1 = await saveNote(page, `Dad waited at Platform 3 every Sunday ${tag}`);
    const n2 = await saveNote(page, `Station at dusk, lamps and steam ${tag}`);
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title: `Platform 3 ${tag}` } })).json()).artifact as { id: string };
    const s = (await (await page.request.post("/api/v1/studio-sessions", { data: { artifactId: art.id } })).json()).workingSet as { sessionId: string };
    await page.request.post(`/api/v1/studio-sessions/${s.sessionId}/sources`, { data: { items: [{ type: "material", id: n1 }, { type: "material", id: n2 }] } });
    // A collaborator's comment → "Use in Studio" lands it on the table, In use.
    const c = (await (await page.request.post(`/api/v1/artifacts/${art.id}/comments`, { data: { body: "The opening should feel emptier." } })).json()) as { comment?: { id: string }; id?: string };
    const commentId = c.comment?.id ?? c.id!;
    await page.goto(`/artifacts/${art.id}/studio?add=comment:${commentId}`);
    await expect(page.getByRole("button", { name: /^Working Set: 3 sources · 1 in use/ })).toBeVisible();

    // Use together: pick the two notes, one dominant action, one idea, directions from the roles.
    await page.getByRole("button", { name: /^Working Set:/ }).click();
    const set = page.getByRole("dialog", { name: "Working Set" });
    await set.getByRole("checkbox", { name: /Select Dad waited/ }).click();
    await set.getByRole("checkbox", { name: /Select Station at dusk/ }).click();
    await set.getByRole("button", { name: /Use together/ }).click();
    const together = page.getByRole("dialog", { name: "2 sources selected" });
    await expect(together.getByRole("radiogroup", { name: "Directions" }).getByRole("radio").first()).toHaveAttribute("aria-checked", "true");
    await together.getByRole("radio", { name: /^Poem/ }).click();
    await together.getByRole("button", { name: /Use this idea/ }).click();
    // Both are now In use (the direction is the same kind of Creation, so no switch is offered here).
    await expect(page.getByRole("button", { name: /^Working Set: 3 sources · 3 in use/ })).toBeVisible();

    // Change format: a new Creation from the same ingredients; its Studio has the same table plus this one.
    await page.getByRole("button", { name: /Writing/ }).click();
    const format = page.getByRole("dialog", { name: "Change format" });
    await format.getByRole("radio", { name: /Carousel/ }).click();
    await format.getByRole("button", { name: "Make it a carousel" }).click();
    await page.waitForURL((u) => /\/artifacts\/[0-9a-f-]{36}\/studio$/.test(u.pathname) && !u.pathname.includes(art.id), { timeout: 60_000 });
    await expect(page.getByRole("button", { name: /^Working Set: 4 sources · 4 in use/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Carousel/ }).first()).toBeVisible();
  });
});
