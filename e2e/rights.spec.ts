import { expect, test, uid, type Page } from "./fixtures";

async function newPiece(page: Page, title: string): Promise<string> {
  await page.goto("/space");
  await page.getByRole("button", { name: "New", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Start a new piece" });
  await dialog.getByLabel("Kind of piece").selectOption({ label: "Poem" });
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByRole("button", { name: "Open Studio" }).click();
  await page.waitForURL(/\/artifacts\/[0-9a-f-]{36}\/studio$/);
  await page.getByLabel("Poem text").fill("Salt on the window;\nthe harbour hums.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Poem · v\d · saved/)).toBeVisible();
  return page.url().split("/").at(-2)!;
}

test.describe("rights step-up", () => {
  test("transferring ownership asks for the password; the API refuses without it", async ({ page, creator, consoleGuard }) => {
    // The step-up round-trip answers 403 by design before the password is given.
    consoleGuard.allow(/status of 403 \(Forbidden\) \(http:\/\/[^)]*\/api\/v1\/artifacts\/[0-9a-f-]+\/rights/);
    const artifactId = await newPiece(page, `Harbour ${uid()}`);
    const rights = { ownershipKind: "transferred", copyrightHolder: "Harbour Press", owners: [{ name: "Harbour Press", sharePercent: 100, creatorId: null }], attributionRequired: true, derivativesAllowed: false };

    // API: no password, or a wrong one, is refused with step_up_required.
    const bare = await page.request.put(`/api/v1/artifacts/${artifactId}/rights`, { data: rights });
    expect(bare.status()).toBe(403);
    expect((await bare.json()).error.code).toBe("step_up_required");
    const wrong = await page.request.put(`/api/v1/artifacts/${artifactId}/rights`, { data: { ...rights, password: "not-the-password" } });
    expect((await wrong.json()).error.code).toBe("step_up_required");

    // UI: saving a transfer opens the password prompt; the correct password completes it.
    await page.goto(`/artifacts/${artifactId}`);
    await page.getByRole("tab", { name: "Rights" }).click();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await page.getByLabel("Ownership").selectOption("transferred");
    await page.getByLabel("Owner 1 name").fill("Harbour Press");
    await page.getByLabel("Copyright holder").fill("Harbour Press");
    await page.getByRole("button", { name: "Save rights" }).click();
    const prompt = page.getByRole("dialog", { name: "Confirm it's you" });
    await expect(prompt).toContainText("confirm your password to transfer ownership");
    await prompt.getByLabel("Password").fill("wrong-password");
    await prompt.getByRole("button", { name: "Confirm" }).click();
    await expect(prompt.getByText("That password isn't right.")).toBeVisible();
    await prompt.getByLabel("Password").fill(creator.password);
    await prompt.getByRole("button", { name: "Confirm" }).click();
    await expect(prompt).toBeHidden();
    await expect(page.getByText("Transferred", { exact: true })).toBeVisible();

    // Still signed in as the same creator (the check didn't replace the session).
    expect((await page.request.get(`/api/v1/artifacts/${artifactId}`)).status()).toBe(200);
  });
});
