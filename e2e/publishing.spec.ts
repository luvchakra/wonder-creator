import { expect, test, uid, type Page } from "./fixtures";

async function pieceWithText(page: Page, title: string, content: string): Promise<string> {
  const res = await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title } });
  const art = (await res.json()).artifact as { id: string; current_version_id: string };
  expect((await page.request.post(`/api/v1/artifacts/${art.id}/versions`, { data: { content, baseVersionId: art.current_version_id, label: "Written" } })).ok()).toBe(true);
  return art.id;
}

test.describe("publishing", () => {
  test("Where → Details → Review → Publish to the profile, and a webhook that fails is retryable", async ({ page, creator }) => {
    void creator;
    test.setTimeout(120_000);
    const title = `Night ferry ${uid()}`;
    const id = await pieceWithText(page, title, "The ferry hums across the dark water.");
    await page.goto(`/artifacts/${id}`);
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Publish" }).click();
    await expect(page).toHaveURL(new RegExp(`/artifacts/${id}/publish$`));
    await expect(page.getByText("This Creation hasn't been published anywhere yet.")).toBeVisible();
    await expect(page.getByText(/Instagram · YouTube/)).toBeVisible();

    // 1. Where: the profile, plus a webhook connected on the spot.
    await page.getByLabel(/Your Wonder Creator profile/).check();
    await page.getByRole("button", { name: "Connect a webhook" }).click();
    const connect = page.getByRole("dialog", { name: "Connect a webhook" });
    await connect.getByLabel("Name").fill("My site");
    await connect.getByLabel("Webhook address").fill("https://wonder-e2e.invalid/hook");
    await connect.getByRole("button", { name: "Connect" }).click();
    await expect(connect.getByLabel("Signing secret")).toHaveValue(/^[0-9a-f]{48}$/);
    await connect.getByRole("button", { name: "Done" }).click();
    await expect(page.getByLabel(/My site/)).toBeChecked();
    await page.getByRole("button", { name: "Next" }).click();

    // 2. Details, drafted by CreatorBrain and editable.
    await page.getByRole("button", { name: "Draft with CreativeMind" }).click();
    await expect(page.getByRole("status").filter({ hasText: "offline development mode" })).toBeVisible();
    await page.getByLabel("Caption", { exact: true }).fill("Out now.");
    await page.getByRole("button", { name: "Next" }).click();

    // 3. Review: the final public representation.
    await expect(page.getByText("Your Wonder Creator profile, My site")).toBeVisible();
    await expect(page.getByText("The Creation becomes public and marked published")).toBeVisible();
    await page.getByRole("button", { name: "Approve and publish" }).click();

    // 4. Outcomes, per destination: published only once confirmed.
    const results = page.getByRole("region", { name: "Publish" });
    const profile = results.getByRole("listitem").filter({ hasText: "Your Wonder Creator profile" });
    await expect(profile).toContainText("Published", { timeout: 30_000 });
    const hook = results.getByRole("listitem").filter({ hasText: "My site" });
    await expect(hook).toContainText("Didn't go through", { timeout: 30_000 });
    await expect(hook.getByRole("button", { name: "Try again" })).toBeVisible();

    // History keeps both, with attempts.
    const history = page.getByRole("region", { name: "Publication history" });
    await expect(history.getByRole("listitem").filter({ hasText: "Your Wonder Creator profile" })).toContainText("Published");
    await expect(history.getByRole("listitem").filter({ hasText: "My site" })).toContainText("1 attempt");
  });
});
