import { artifactCard, expect, saveNote, test, uid } from "./fixtures";

test.describe("Material collections", () => {
  test.beforeEach(({ creator }) => void creator);

  test("create, fill, order, rename, archive and delete a collection without touching its material", async ({ page }) => {
    const first = `Harbour at dusk ${uid()}`;
    const second = `Lantern on the jetty ${uid()}`;
    const firstId = await saveNote(page, first);
    await saveNote(page, second);

    await page.goto("/space?tab=collections");
    await expect(page.getByRole("heading", { name: "No collections yet" })).toBeVisible();
    await page.getByRole("button", { name: "New collection" }).click();
    const create = page.getByRole("dialog", { name: "New collection" });
    await create.getByRole("button", { name: "Visual Style" }).click();
    await expect(create.getByLabel("Name")).toHaveValue("Visual Style");
    await create.getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL(/\/space\/collections\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "Visual Style" })).toBeVisible();
    await expect(page.getByText("Private to you")).toBeVisible();

    // Add both notes at once.
    await page.getByRole("button", { name: "Add material" }).first().click();
    const add = page.getByRole("dialog", { name: "Add material" });
    await add.getByLabel(first).check();
    await add.getByLabel(second).check();
    await add.getByRole("button", { name: "Add 2" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Added 2 to Visual Style." })).toBeVisible();
    const items = page.getByRole("list", { name: "Collection items" }).getByRole("listitem");
    await expect(items).toHaveCount(2);

    // Move whichever note is second to the front; the order survives a reload.
    const back = (await items.nth(1).textContent())?.includes(first) ? first : second;
    await page.getByRole("button", { name: `Move ${back} earlier` }).click();
    await expect(page.getByRole("status").filter({ hasText: "earlier" })).toBeVisible();
    await page.reload();
    await expect(items.first()).toContainText(back);

    // Search within the collection.
    await page.getByLabel("Search this collection").fill("lantern");
    await expect(items).toHaveCount(1);
    await page.getByLabel("Search this collection").fill("");

    // Removing only takes it out of the collection.
    await page.getByRole("button", { name: `Remove ${first} from this collection` }).click();
    await expect(page.getByRole("status").filter({ hasText: "still in your Creative Space" })).toBeVisible();
    await expect(items).toHaveCount(1);
    await page.goto(`/space/materials/${firstId}`);
    await expect(page.getByLabel("Text")).toHaveValue(first);
    await page.goBack();

    // Rename, archive, then find it under archived.
    await page.getByRole("button", { name: "Rename" }).click();
    const edit = page.getByRole("dialog", { name: "Edit collection" });
    await edit.getByLabel("Name").fill("Night palette");
    await edit.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: "Night palette" })).toBeVisible();
    await page.getByRole("button", { name: "Archive" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Collection archived." })).toBeVisible();
    await page.goto("/space?tab=collections");
    await expect(page.getByRole("link", { name: /Night palette/ })).toHaveCount(0);
    await page.getByRole("link", { name: "Show archived collections" }).click();
    await page.getByRole("link", { name: /Night palette/ }).click();

    // Delete the collection; the material is still there.
    await page.getByRole("button", { name: "Delete" }).click();
    const confirm = page.getByRole("dialog", { name: "Delete this collection?" });
    await expect(confirm).toContainText("Everything in it stays in your Creative Space");
    await confirm.getByRole("button", { name: "Delete collection" }).click();
    await expect(page).toHaveURL(/\/space\?tab=collections$/);
    await page.goto("/space?tab=ideas");
    await expect(page.getByRole("link").filter({ hasText: second })).toBeVisible();
  });

  test("use a collection in creation: the new piece records the collection in its lineage", async ({ page }) => {
    const note = `Monsoon on the terrace ${uid()}`;
    const noteId = await saveNote(page, note);
    const name = `Rain ${uid()}`;
    expect((await page.request.post("/api/v1/collections", { data: { name } })).ok()).toBe(true);
    const list = await (await page.request.get("/api/v1/collections")).json();
    const col = (list.collections as Array<{ id: string; name: string }>).find((c) => c.name === name)!;
    expect((await page.request.post(`/api/v1/collections/${col.id}/items`, { data: { materialId: noteId } })).ok()).toBe(true);

    await page.goto(`/space/collections/${col.id}`);
    await page.getByRole("link", { name: "Use in creation" }).click();
    await expect(page).toHaveURL(new RegExp(`/create\\?collection=${col.id}`));
    const talk = page.getByRole("region", { name: "CreatorTalk" });
    await expect(talk.getByText(`From collection: ${name}`)).toBeVisible();
    await expect(talk.getByText(note)).toBeVisible();
    await talk.getByLabel("What are you thinking about?").fill("Turn these notes into a poem.");
    await talk.getByRole("button", { name: "Send", exact: true }).click();
    const card = artifactCard(page);
    await expect(card).toBeVisible({ timeout: 45_000 });
    const href = await card.getByRole("link", { name: "Open in Studio" }).getAttribute("href");
    const artifactId = /\/artifacts\/([0-9a-f-]{36})/.exec(href ?? "")?.[1];
    expect(artifactId).toBeTruthy();

    await page.goto(`/artifacts/${artifactId}`);
    await page.getByRole("link", { name: "Context", exact: true }).click();
    await page.getByRole("navigation", { name: "Context sections" }).getByRole("link", { name: /^Related/ }).click();
    const lineage = page.getByRole("list", { name: "Creative lineage, from sources to derivatives" });
    const source = lineage.getByRole("link", { name: new RegExp(name) });
    await expect(source).toHaveAttribute("href", `/space/collections/${col.id}`);
    await expect(source).toContainText("Collection");
  });
});
