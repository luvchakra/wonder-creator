import { expect, saveNote, test, uid } from "./fixtures";

// Phase 01 — Moments + DejaVu (docs/moments-dejavu.md §9–11, §15 UI).
test.describe("DejaVu", () => {
  test.beforeEach(({ creator }) => void creator);

  test("start a DejaVu on a Material, add the same one to a Creation, open it, filter, take one off and put it back", async ({ page }) => {
    const tag = uid();
    const thread = `Railways ${tag}`;
    const note = await saveNote(page, `Dad's railway story ${tag}\nHe waited at Platform 3.`);
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title: `A Life in Moments ${tag}` } })).json()).artifact as { id: string };

    // Material: + DejaVu → Create "…" → the chip is there.
    await page.goto(`/space/materials/${note}`);
    const chips = page.getByRole("group", { name: "DejaVus" });
    await chips.getByRole("button", { name: "Add a DejaVu" }).click();
    const sheet = page.getByRole("dialog", { name: "Add a DejaVu" });
    await sheet.getByLabel("Search or type a DejaVu").fill(thread);
    await sheet.getByRole("button", { name: `Create “${thread}”` }).click();
    await expect(sheet.getByRole("status")).toContainText(`Started “${thread}”`);
    await page.keyboard.press("Escape");
    await expect(chips.getByRole("link", { name: thread })).toBeVisible();

    // Creation: search finds the existing one (typed differently) — no duplicate is offered.
    await page.goto(`/artifacts/${art.id}`);
    await page.getByRole("group", { name: "DejaVus" }).getByRole("button", { name: "Add a DejaVu" }).click();
    await sheet.getByLabel("Search or type a DejaVu").fill(thread.toLowerCase());
    const match = sheet.getByRole("list", { name: "Matching DejaVus" }).getByRole("button", { name: thread });
    await expect(match).toHaveAttribute("aria-pressed", "false");
    await expect(sheet.getByRole("button", { name: /^Create “/ })).toHaveCount(0);
    await match.click();
    await expect(match).toHaveAttribute("aria-pressed", "true");
    // Immediately reversible, and back again.
    await match.click();
    await expect(match).toHaveAttribute("aria-pressed", "false");
    await match.click();
    await expect(match).toHaveAttribute("aria-pressed", "true");
    await page.keyboard.press("Escape");

    // The chip opens the DejaVu: both Moments, newest first, with type filters for the types present.
    await page.getByRole("group", { name: "DejaVus" }).getByRole("link", { name: thread }).click();
    await expect(page.getByRole("heading", { level: 1, name: thread })).toBeVisible();
    await expect(page.getByText("2 Moments")).toBeVisible();
    await expect(page.getByRole("region", { name: "Today" }).getByRole("link")).toHaveCount(2);
    const types = page.getByRole("navigation", { name: "Types" });
    await expect(types.getByRole("link")).toHaveText(["All", "Notes1", "Creations1"]);
    await types.getByRole("link", { name: /Creations/ }).click();
    await expect(page).toHaveURL(/filter=creations/);
    const list = page.getByRole("region", { name: "Today" });
    await expect(list.getByRole("link")).toHaveCount(1);
    await expect(list.getByRole("link")).toContainText(`A Life in Moments ${tag}`);
    await types.getByRole("link", { name: "All" }).click();
    await expect(page.getByRole("region", { name: "Today" }).getByRole("link")).toHaveCount(2);

    // Take one off; Undo puts it back.
    await page.getByRole("button", { name: `More for A Life in Moments ${tag}` }).click();
    await page.getByRole("menuitem", { name: `Take off ${thread}` }).click();
    await expect(page.getByText("1 Moment", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Undo" }).click();
    await expect(page.getByText("2 Moments")).toBeVisible();
    await page.reload();
    await expect(page.getByRole("region", { name: "Today" }).getByRole("link")).toHaveCount(2);

    // A deleted Material leaves safely; the DejaVu and the rest stay.
    expect((await page.request.delete(`/api/v1/materials/${note}?confirm=true`)).ok()).toBe(true);
    await page.reload();
    await expect(page.getByText("1 Moment", { exact: true })).toBeVisible();
    await expect(page.getByRole("region", { name: "Today" }).getByRole("link")).toHaveCount(1);
    // One type left: no type filters.
    await expect(page.getByRole("navigation", { name: "Types" })).toHaveCount(0);
  });

  test("an empty DejaVu says so with one way forward; DejaVus that aren't yours don't exist", async ({ page }) => {
    const r = await (await page.request.post("/api/v1/dejavus", { data: { name: `Waiting ${uid()}` } })).json();
    await page.goto(`/dejavu/${r.dejavu.id}`);
    await expect(page.getByText("Nothing carries this DejaVu yet")).toBeVisible();
    await expect(page.getByRole("link", { name: "Open Materials" })).toBeVisible();
    // The same name again is the same DejaVu.
    const again = await (await page.request.post("/api/v1/dejavus", { data: { name: `  ${r.dejavu.name.toUpperCase()} ` } })).json();
    expect(again).toMatchObject({ existed: true, dejavu: { id: r.dejavu.id } });
    // Someone else's (or no) DejaVu: not found, never an empty page.
    expect((await page.request.get("/api/v1/dejavus/00000000-0000-4000-8000-000000000000")).status()).toBe(404);
    expect((await page.request.post("/api/v1/dejavus/00000000-0000-4000-8000-000000000000/moments", { data: { entityType: "creation", entityId: r.dejavu.id } })).status()).toBe(404);
  });
});
