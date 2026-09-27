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
    await page.goto(`/artifacts/${art.id}`);
    await expect(strip).toHaveAttribute("aria-label", /^v1 · Draft/);
    await expect(strip).not.toContainText(title);

    // In the Studio the strip carries the save state, then returns to the version.
    await page.goto(`/artifacts/${art.id}/studio`);
    await page.getByLabel("Poem text").fill("The harbour keeps its lights.");
    await expect(strip).toHaveAttribute("aria-label", /^Unsaved changes/);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(strip).toHaveAttribute("aria-label", /^Saved/);
    await expect(strip).toHaveAttribute("aria-label", /^v2 · In progress/);

    // Home now points at the Creation in progress.
    await page.goto("/");
    await expect(strip).toHaveAttribute("aria-label", `${title} · In progress`);

    // Lists say how many; the Approval Center says whether anything waits.
    await page.goto("/space?tab=ideas");
    await expect(strip).toHaveAttribute("aria-label", /^\d+ materials?$/);
    // It never repeats what the page already says: an empty Approval Center leaves it blank.
    await page.goto("/approvals");
    await expect(page.getByRole("heading", { name: "Nothing waiting" })).toBeVisible();
    await expect(strip).toHaveCount(0);
  });
});
