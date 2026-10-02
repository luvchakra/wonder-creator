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

    // Home lists each waiting request under "You could help", linking to its approval.
    await page.goto("/");
    const help = page.getByRole("region", { name: "You could help" });
    // It opens in place (Home rows, phase 02): a summary first, the requests when asked for.
    await help.getByText("You could help").click();
    await expect(help.getByRole("link", { name: /Waiting for your OK/ })).toHaveCount(2);
    await expect(help.getByRole("link", { name: /Waiting for your OK/ }).first()).toHaveAttribute("href", /^\/approvals\/[0-9a-f-]{36}$/);
    await page.goto("/approvals");
    await expect(page.getByRole("heading", { name: "Approvals", level: 1 })).toBeVisible();
    await expect(page.getByText("CreativeMind asks before acting on creative generation")).toBeVisible();
    await expect(page.getByRole("link", { name: "Change autonomy settings" })).toHaveAttribute("href", "/settings?section=autonomy");

    // The detail shows exactly what will run.
    await page.getByRole("link", { name: new RegExp(`Create a new Creation.*${first}`) }).click();
    await expect(page).toHaveURL(/\/approvals\/[0-9a-f-]{36}$/);
    const originalUrl = page.url();
    await expect(page.getByText(`Request: Write a poem about ${first}.`)).toBeVisible();
    await expect(page.getByText("No rights changes")).toBeVisible();
    await expect(page.getByText("No cost")).toBeVisible();

    // Editing makes a new request that replaces this one.
    await page.getByRole("button", { name: "Edit" }).click();
    const edit = page.getByRole("dialog", { name: "Edit the request" });
    await edit.getByLabel("Kind of Creation").selectOption("story");
    await edit.getByLabel("Request").fill(`A story about ${first}`);
    await edit.getByRole("button", { name: "Save as new request" }).click();
    await expect(page).not.toHaveURL(originalUrl);
    await expect(page.getByText(`Request: A story about ${first}`)).toBeVisible();
    await expect(page.getByText("This replaces an earlier request.")).toBeVisible();

    // Approving runs it once and opens the new piece.
    await page.getByRole("button", { name: "Approve once" }).click();
    await expect(page).toHaveURL(/\/creations\/[0-9a-f-]{36}$/, { timeout: 45_000 });

    // The other one is declined with a note.
    await page.goto("/approvals");
    await page.getByRole("link", { name: new RegExp(`Create a new Creation.*${second}`) }).click();
    await page.getByRole("button", { name: "Decline" }).click();
    const decline = page.getByRole("dialog", { name: "Decline this?" });
    await decline.getByLabel("Note (optional)").fill("Not this week");
    await decline.getByRole("button", { name: "Decline" }).click();
    await expect(page.getByText("Note: Not this week")).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve once" })).toHaveCount(0);

    // History shows every decision.
    await page.goto("/approvals");
    await expect(page.getByText("Nothing waiting")).toBeVisible();
    const history = page.getByRole("list").filter({ hasText: "Approved and done" });
    await expect(history).toContainText("Declined");
    await expect(history).toContainText("Cancelled");
  });
});

test.describe("Autonomy approval in meTalk", () => {
  test.beforeEach(({ creator }) => void creator);

  test("a blocked action asks narrowly, links its detail, and returns to the conversation", async ({ page }) => {
    expect((await page.request.patch("/api/v1/creators/autonomy", { data: { domain: "creative_generation", level: "execute_with_approval" } })).ok()).toBe(true);
    const subject = `the harbour ${uid()}`;
    const res = await page.request.post("/api/v1/conversations/turn", { data: { message: `Write a poem about ${subject}.` } });
    const conversationId = /"conversationId":"([0-9a-f-]{36})"/.exec(await res.text())?.[1];
    expect(conversationId).toBeTruthy();

    await page.goto(`/create?c=${conversationId}`);
    const talk = page.getByRole("region", { name: "meTalk" });
    await expect(talk.getByText("I'm asking because creative generation is set to ask first. Approving covers only this.")).toBeVisible();
    await expect(talk.getByRole("link", { name: "Autonomy settings" })).toHaveAttribute("href", "/settings?section=autonomy");
    await talk.getByRole("link", { name: "Details" }).click();
    await expect(page).toHaveURL(/\/approvals\/[0-9a-f-]{36}$/);
    await expect(page.getByText("your setting: Ask for approval")).toBeVisible();
    await page.getByRole("link", { name: "← Back to the conversation" }).click();
    await expect(page).toHaveURL(new RegExp(`/create\\?c=${conversationId}$`));

    await talk.getByRole("button", { name: "Approve once" }).click();
    await expect(talk.getByRole("link", { name: "Open it" })).toBeVisible({ timeout: 45_000 });
  });
});
