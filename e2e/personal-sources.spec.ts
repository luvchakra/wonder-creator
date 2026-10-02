import { expect, seedNotes, test } from "./fixtures";

test.describe("Personal Sources", () => {
  test("connect your notes, sync on your terms, review a group and bring in only what you choose", async ({ page, creator }) => {
    await seedNotes(creator.id, [
      { title: "Café ideas", text: "Loved the quiet corners at Vohuman. The streets felt unusually quiet.", place: "Pune", daysAgo: 2 },
      { title: "Sketches from Pune", text: "People, light, architecture —", place: "Pune", daysAgo: 2 },
      { title: "Lighthouse", text: "What if the lighthouse kept every name it ever saw,", daysAgo: 120 },
    ]);
    // Home invites, it doesn't scan: nothing is connected yet.
    await page.goto("/");
    const world = page.getByRole("region", { name: "From your world" });
    await expect(world.getByText("Discover useful context from places you already keep your memories.")).toBeVisible();
    await world.getByRole("link", { name: "Connect sources" }).click();
    await expect(page).toHaveURL(/\/sources$/);
    await expect(page.getByRole("heading", { name: "Connect your world" })).toBeVisible();

    // Mail and calendar aren't faked: they say they're not set up. Notes connect directly and sync at once.
    const list = page.getByRole("list", { name: "Your sources" });
    await expect(list.getByRole("listitem").filter({ hasText: "Gmail" })).toContainText("Not set up yet");
    await list.getByRole("listitem").filter({ hasText: "Notes" }).getByRole("button", { name: "Connect" }).click();
    const pune = page.getByRole("link", { name: /in Pune/ });
    await expect(pune).toBeVisible({ timeout: 30_000 });
    await expect(list.getByRole("listitem").filter({ hasText: "Notes" })).toContainText("Last synced");
    await expect(page.getByRole("link", { name: /An unfinished thought/ })).toBeVisible();

    // A repeated Sync is safe and the page stays usable.
    await page.getByRole("button", { name: "Sync now" }).click();
    await expect(page.getByRole("button", { name: "Sync now" })).toBeVisible({ timeout: 30_000 });

    // Review: only the chosen item comes in.
    await pune.click();
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(/in Pune$/);
    await expect(page.getByText("“Loved the quiet corners at Vohuman.”")).toBeVisible();
    await page.locator("label").filter({ hasText: "Sketches from Pune" }).click();
    await expect(page.getByRole("checkbox", { name: /Sketches from Pune/ })).not.toBeChecked();
    await page.getByRole("button", { name: "Add selected to Materials · 1 item" }).click();
    await expect(page).toHaveURL(/\/space\?tab=ideas/);

    // Home now offers the next thing from your world, with a quiet Sync.
    await page.goto("/");
    await expect(world.getByText("An unfinished thought")).toBeVisible();
    await expect(world.getByRole("button", { name: "Sync your sources" })).toBeVisible();
    await world.getByRole("link", { name: "Explore" }).click();
    await page.getByRole("button", { name: "Not this one" }).click();
    await expect(page).toHaveURL(/\/sources$/);
    await expect(page.getByRole("link", { name: /An unfinished thought/ })).toHaveCount(0);
  });

  test("disconnecting deletes what was discovered and keeps the creator's Materials", async ({ page, creator }) => {
    await seedNotes(creator.id, [{ title: "Station", text: "Platform 3 at dawn, again.", place: "Mumbai", daysAgo: 1 }, { title: "Station 2", text: "Chai and trains.", place: "Mumbai", daysAgo: 1 }]);
    await page.goto("/sources");
    await page.getByRole("list", { name: "Your sources" }).getByRole("listitem").filter({ hasText: "Notes" }).getByRole("button", { name: "Connect" }).click();
    await expect(page.getByRole("link", { name: /in Mumbai/ })).toBeVisible({ timeout: 30_000 });
    await page.getByRole("link", { name: "Manage Notes" }).click();
    await expect(page.getByRole("heading", { name: "Notes" })).toBeVisible();
    await page.getByRole("button", { name: "Disconnect Notes" }).click();
    await page.getByRole("dialog", { name: "Disconnect Notes?" }).getByRole("button", { name: "Disconnect" }).click();
    await expect(page).toHaveURL(/\/sources$/);
    await expect(page.getByRole("link", { name: /in Mumbai/ })).toHaveCount(0);
    await expect(page.getByRole("list", { name: "Your sources" }).getByRole("listitem").filter({ hasText: "Notes" })).toContainText("Not connected");
    const mats = await (await page.request.get("/api/v1/materials?filter=notes")).json();
    expect(JSON.stringify(mats)).toContain("Platform 3 at dawn");
  });
});
