import { artifactCard, expect, test } from "./fixtures";

test.describe("Creation run progress", () => {
  test.beforeEach(({ creator }) => void creator);

  test("a finished creation links to its run: stages, the saved piece, no retry", async ({ page }) => {
    await page.goto("/create");
    const talk = page.getByRole("region", { name: "meTalk" });
    await talk.getByLabel("What are you thinking about?").fill("Write a poem about the night ferry.");
    await talk.getByRole("button", { name: "Send", exact: true }).click();
    await expect(artifactCard(page)).toBeVisible({ timeout: 45_000 });

    await talk.getByRole("link", { name: "How it was made" }).click();
    await expect(page).toHaveURL(/\/create\/runs\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "Your draft is ready" })).toBeVisible();
    const stages = page.getByRole("list", { name: "Stages" });
    await expect(stages.getByRole("listitem").filter({ hasText: "Creating" })).toContainText("Done");
    await expect(stages.getByRole("listitem").filter({ hasText: "Saving your draft" })).toContainText("Done");
    await expect(page.getByRole("button", { name: "Try again" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Stop" })).toHaveCount(0);
    await page.getByRole("link", { name: /Open “.*” in the Creative Studio/ }).click();
    await expect(page).toHaveURL(/\/creations\/[0-9a-f-]{36}\/(?:studio|write)$/);
  });

  test("an unknown or someone else's run is not found", async ({ page }) => {
    await page.goto("/create/runs/00000000-0000-4000-8000-000000000000");
    await expect(page.getByRole("heading", { name: "We couldn't find that" })).toBeVisible();
    expect((await page.request.post("/api/v1/brain/runs/00000000-0000-4000-8000-000000000000/cancel")).status()).toBe(404);
  });
});
