import { expect, test, uid, type Page } from "./fixtures";

async function pieceWithText(page: Page, title: string, content: string): Promise<string> {
  const res = await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title } });
  const art = (await res.json()).artifact as { id: string; current_version_id: string };
  expect((await page.request.post(`/api/v1/artifacts/${art.id}/versions`, { data: { content, baseVersionId: art.current_version_id, label: "Written" } })).ok()).toBe(true);
  return art.id;
}

test.describe("CreatorPublish", () => {
  test("preferences prefill, CreativeMind plans (suggestions only), schedule as suggested, and the queue shows it per destination", async ({ page, creator }) => {
    void creator;
    test.setTimeout(120_000);
    const title = `Tide tables ${uid()}`;
    const id = await pieceWithText(page, title, "The sea keeps its own hours.");

    // Preferences on the Publishing page.
    await page.goto("/publishing");
    await expect(page.getByRole("heading", { name: "Publishing", level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Queue" })).toContainText("Nothing waiting");
    const prefs = page.getByRole("region", { name: "Publishing preferences" });
    await prefs.getByLabel("Your Wonder Creator profile").check();
    await prefs.getByLabel("Default tags").fill("poetry, #sea");
    await prefs.getByLabel("Preferred time").fill("18:30");
    await prefs.getByLabel("Time zone").selectOption("Asia/Kolkata");
    await prefs.getByRole("button", { name: "Save preferences" }).click();
    await expect(page.getByText("Publishing preferences saved.").first()).toBeVisible();

    // The flow starts from them; CreatorBrain's plan is a suggestion.
    await page.goto(`/creations/${id}/publish`);
    await expect(page.getByLabel(/Your Wonder Creator profile/)).toBeChecked();
    await page.getByRole("button", { name: "Plan with CreativeMind" }).click();
    await expect(page.getByRole("status").filter({ hasText: "nothing is prepared or sent until you approve" })).toContainText("AI isn't connected");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByLabel("Tags")).toHaveValue("poetry, sea");
    await page.getByRole("button", { name: "Next" }).click();
    await expect(page.getByLabel("As CreativeMind suggested")).toBeChecked();
    await page.getByRole("button", { name: "Approve and schedule" }).click();
    await expect(page.getByText("Scheduled").first()).toBeVisible();

    // The queue shows it with its destination, status and tags; cancelling moves it to history.
    await page.goto("/publishing");
    const queue = page.getByRole("region", { name: "Queue" });
    const card = queue.getByRole("listitem").filter({ hasText: title });
    await expect(card).toContainText("Scheduled");
    await expect(card).toContainText("#poetry #sea");
    await expect(card).toContainText("Your Wonder Creator profile");
    await card.getByRole("button", { name: "Cancel" }).click();
    const views = page.getByRole("radiogroup", { name: "Publishing view" });
    await views.getByRole("radio", { name: /^Published/ }).click();
    await expect(page.getByRole("region", { name: "Published" })).toContainText(title);

    // A draft can be edited per destination from the queue.
    await page.request.post(`/api/v1/artifacts/${id}/publications`, { data: { destinations: [{ kind: "profile" }], title } });
    await page.reload();
    await views.getByRole("radio", { name: /^Drafts/ }).click();
    const drafts = page.getByRole("region", { name: "Drafts" });
    const draft = drafts.getByRole("listitem").filter({ hasText: "waiting for your approval" }).first();
    await draft.getByRole("button", { name: "Edit" }).click();
    const edit = page.getByRole("dialog", { name: /Edit for/ });
    await edit.getByLabel("Tags").fill("tides");
    await edit.getByRole("button", { name: "Save draft" }).click();
    await expect(drafts.getByRole("listitem").filter({ hasText: "#tides" })).toBeVisible();
  });
});
