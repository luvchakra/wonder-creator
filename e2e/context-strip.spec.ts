import { expect, test, uid } from "./fixtures";

test.describe("navbar Context Strip", () => {
  test.beforeEach(({ creator }) => void creator);

  test("says what's happening here — stage, save state, counts — in one quiet line", async ({ page }) => {
    const strip = page.getByRole("banner").getByRole("status");

    // Home without a Creation in progress is calm.
    await page.goto("/");
    await expect(strip).toHaveAttribute("aria-label", /Ready to create|· In progress/);

    // A Creation shows its version and stage, never its title.
    const title = `Harbour ${uid()}`;
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title } })).json()).artifact as { id: string; current_version_id: string };
    await page.goto(`/creations/${art.id}`);
    await expect(strip).toHaveAttribute("aria-label", /^v1 · Draft/);
    await expect(strip).not.toContainText(title);

    // In the Studio the strip carries the save state, then returns to the version.
    await page.goto(`/creations/${art.id}/studio`);
    // Typing autosaves a draft; Save turns it into a version and the strip says which.
    await page.getByLabel("Poem text").fill("The harbour keeps its lights.");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByRole("dialog", { name: "Save as new version" }).getByRole("button", { name: "Save version" }).click();
    await expect(strip).toHaveAttribute("aria-label", /^Saved · v2/);
    await expect(strip).toHaveAttribute("aria-label", /^v2 · In progress/);

    // Home now points at the Creation in progress.
    await page.goto("/");
    // Home leads with its one truth (phase 02 §12); the Creation in progress follows.
    await expect(strip).toHaveAttribute("aria-label", `Nothing urgent, ${title} · In progress`);

    // Lists say how many; the Approval Center says whether anything waits.
    await page.goto("/materials?tab=ideas");
    await expect(strip).toHaveAttribute("aria-label", /^\d+ materials?$/);
    // It never repeats what the page already says: an empty Approval Center leaves it blank.
    await page.goto("/approvals");
    await expect(page.getByRole("heading", { name: "Nothing waiting" })).toBeVisible();
    await expect(strip).toHaveCount(0);
  });

  test("the AI context line never guesses: without a live model it stays quiet, and it only takes known pages", async ({ page }) => {
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title: `Quiet ${uid()}` } })).json()).artifact as { id: string };
    const ok = await page.request.get(`/api/v1/context-line?page=creation&id=${art.id}`);
    expect(ok.status()).toBe(200);
    expect(await ok.json()).toEqual({ text: null });
    expect((await page.request.get("/api/v1/context-line?page=settings")).status()).toBe(422);
    expect((await page.request.get("/api/v1/context-line?page=creation&id=not-an-id")).status()).toBe(422);
    // The deterministic line is still there.
    await page.goto(`/creations/${art.id}`);
    await expect(page.getByRole("banner").getByRole("status")).toHaveAttribute("aria-label", /^v1 · Draft/);
  });
});
