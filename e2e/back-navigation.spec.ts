import { expect, test, uid } from "./fixtures";

// Back goes where you came from (docs/ui-redesign/back-navigation.md): a return, not a parent link.
test.describe("Back navigation", () => {
  test.beforeEach(({ creator }) => void creator);

  test("Room → Lyrics → Back is the Room; Preview → Back → Back walks the trail", async ({ page }) => {
    const title = `make a song ${uid()}`;
    await page.goto("/rooms?new=1");
    const create = page.getByRole("dialog", { name: "New Creative Room" });
    await create.getByLabel("Name").fill(title);
    await create.getByLabel(/^Song/).check();
    await create.getByLabel("Already underway").check();
    await create.getByRole("button", { name: "Create Creative Room" }).click();
    await expect(page).toHaveURL(/\/rooms\/[0-9a-f-]{36}$/);
    const room = new URL(page.url()).pathname;
    const work = page.getByRole("region", { name: "The work" });
    await work.getByRole("button", { name: "Claim a part" }).click();
    await page.getByRole("dialog", { name: "Claim a part" }).getByRole("button", { name: /Lyrics/ }).click();
    await work.getByRole("button", { name: "Start Lyrics" }).click();
    await expect(page).toHaveURL(/\/write$/);
    const write = new URL(page.url()).pathname;
    const id = write.split("/")[2]!;
    const art = (await (await page.request.get(`/api/v1/artifacts/${id}`)).json()).artifact as { current_version_id: string };
    await page.request.post(`/api/v1/artifacts/${id}/versions`, { data: { content: "Every Sunday my father waited", baseVersionId: art.current_version_id, label: "First words" } });
    await page.reload();

    // The owner's case: Back names the Room and goes there.
    await expect(page.getByRole("link", { name: `Back to ${title}` })).toBeVisible();
    await page.getByRole("link", { name: `Back to ${title}` }).click();
    await expect(page).toHaveURL(new RegExp(`${room}$`));

    // Room → Lyrics → Preview → Back → Back: the Writing page, then the Room.
    await work.getByRole("link", { name: "Open Lyrics" }).click();
    await expect(page).toHaveURL(new RegExp(`${write}$`));
    await page.getByRole("link", { name: "Preview", exact: true }).click();
    await expect(page).toHaveURL(/\/preview$/);
    await page.getByRole("link", { name: /^Close, back to / }).click();
    await expect(page).toHaveURL(new RegExp(`${write}$`));
    await page.getByRole("link", { name: /^Back to / }).click();
    await expect(page).toHaveURL(new RegExp(`${room}$`));

    // A new tab has no trail: the Writing page's Back goes home, and a part's home is its Room.
    const fresh = await page.context().newPage();
    await fresh.goto(write);
    await expect(fresh.getByRole("link", { name: `Back to ${title}` })).toHaveAttribute("href", room);
    await fresh.close();
  });

  test("Creations → Creation page → Continue writing → Back → Back; Context → Back; from= in a new tab; deleting forgets", async ({ page }) => {
    const title = `Harbour lamps ${uid()}`;
    const res = await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title } });
    const art = (await res.json()).artifact as { id: string; current_version_id: string };
    await page.request.post(`/api/v1/artifacts/${art.id}/versions`, { data: { content: "The lamps come on one by one.", baseVersionId: art.current_version_id, label: "Written" } });

    await page.goto("/materials?tab=creations");
    await page.goto(`/creations/${art.id}`);
    await page.getByRole("link", { name: "Continue writing" }).click();
    await expect(page).toHaveURL(new RegExp(`/creations/${art.id}/write$`));
    await page.getByRole("link", { name: /^Back to / }).click();
    await expect(page).toHaveURL(new RegExp(`/creations/${art.id}$`));
    await page.getByRole("link", { name: /^Back to / }).click();
    await expect(page).toHaveURL(/\/materials\?tab=creations$/);

    // Creation page → More › Context → Back: the Creation page.
    await page.goto(`/creations/${art.id}`);
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Context" }).click();
    await expect(page).toHaveURL(new RegExp(`/creations/${art.id}/context`));
    await page.getByRole("link", { name: /^Back to / }).click();
    await expect(page).toHaveURL(new RegExp(`/creations/${art.id}$`));

    // A link carrying ?from= in a new tab (no trail): Back goes there.
    const fresh = await page.context().newPage();
    const roomId = "00000000-0000-4000-8000-000000000000";
    await fresh.goto(`/creations/${art.id}/write?from=room:${roomId}`);
    await expect(fresh.getByRole("link", { name: "Back to the Creative Room" })).toBeVisible();
    await expect(fresh.getByRole("link", { name: "Back to the Creative Room" })).toHaveAttribute("href", `/rooms/${roomId}`);
    await fresh.close();

    // Deleting the Creation drops its pages: Back from Materials never offers it again.
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Delete permanently" }).click();
    await page.getByRole("dialog", { name: "Delete this Creation permanently?" }).getByRole("button", { name: "Delete permanently" }).click();
    await expect(page).toHaveURL(/\/materials$/);
    const trail = await page.evaluate(() => sessionStorage.getItem("wc.nav.trail") ?? "");
    expect(trail).not.toContain(`/creations/${art.id}`);
  });
});
