import { expect, test, uid, type Page } from "./fixtures";

async function askForPoem(page: Page, subject: string) {
  const res = await page.request.post("/api/v1/conversations/turn", { data: { message: `Write a poem about ${subject}.` } });
  expect(res.ok()).toBe(true);
  expect(await res.text()).toContain("proposal");
}

test.describe("Approval Center", () => {
  test.beforeEach(({ creator }) => void creator);

  test("review exact parameters, edit into a new request, approve once; decline with a note", async ({ page }) => {
    test.setTimeout(120_000);
    expect((await page.request.patch("/api/v1/creators/autonomy", { data: { domain: "creative_generation", level: "execute_with_approval" } })).ok()).toBe(true);
    const first = `the lighthouse ${uid()}`;
    const second = `the tide ${uid()}`;
    await askForPoem(page, first);
    await askForPoem(page, second);

    // Home points to the Approval Center.
    await page.goto("/");
    await page.getByRole("link", { name: /2 proposals waiting for your approval/ }).click();
    await expect(page).toHaveURL(/\/approvals$/);
    await expect(page.getByRole("heading", { name: "Approvals", level: 1 })).toBeVisible();
    await expect(page.getByText("CreatorBrain asks before acting on creative generation")).toBeVisible();
    await expect(page.getByRole("link", { name: "Change autonomy settings" })).toHaveAttribute("href", "/settings?section=autonomy");

    // The detail shows exactly what will run.
    await page.getByRole("link", { name: new RegExp(`Create a new piece.*${first}`) }).click();
    await expect(page).toHaveURL(/\/approvals\/[0-9a-f-]{36}$/);
    const originalUrl = page.url();
    await expect(page.getByText(`Request: Write a poem about ${first}.`)).toBeVisible();
    await expect(page.getByText("No rights changes")).toBeVisible();
    await expect(page.getByText("No cost")).toBeVisible();

    // Editing makes a new request that replaces this one.
    await page.getByRole("button", { name: "Edit" }).click();
    const edit = page.getByRole("dialog", { name: "Edit the request" });
    await edit.getByLabel("Kind of piece").selectOption("story");
    await edit.getByLabel("Request").fill(`A story about ${first}`);
    await edit.getByRole("button", { name: "Save as new request" }).click();
    await expect(page).not.toHaveURL(originalUrl);
    await expect(page.getByText(`Request: A story about ${first}`)).toBeVisible();
    await expect(page.getByText("This replaces an earlier request.")).toBeVisible();

    // Approving runs it once and opens the new piece.
    await page.getByRole("button", { name: "Approve" }).click();
    await expect(page).toHaveURL(/\/artifacts\/[0-9a-f-]{36}$/, { timeout: 45_000 });

    // The other one is declined with a note.
    await page.goto("/approvals");
    await page.getByRole("link", { name: new RegExp(`Create a new piece.*${second}`) }).click();
    await page.getByRole("button", { name: "Decline" }).click();
    const decline = page.getByRole("dialog", { name: "Decline this?" });
    await decline.getByLabel("Note (optional)").fill("Not this week");
    await decline.getByRole("button", { name: "Decline" }).click();
    await expect(page.getByText("Note: Not this week")).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve" })).toHaveCount(0);

    // History shows every decision.
    await page.goto("/approvals");
    await expect(page.getByText("Nothing waiting")).toBeVisible();
    const history = page.getByRole("list").filter({ hasText: "Approved and done" });
    await expect(history).toContainText("Declined");
    await expect(history).toContainText("Cancelled");
  });
});
