import { expect, test, uid, type Page } from "./fixtures";

async function newPiece(page: Page, title: string): Promise<string> {
  await page.goto("/materials");
  await page.getByRole("button", { name: "New", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Start a new Creation" });
  await dialog.getByLabel("Kind of Creation").selectOption({ label: "Poem" });
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByRole("button", { name: "Open Creative Studio" }).click();
  await page.waitForURL(/\/creations\/[0-9a-f-]{36}\/studio$/);
  await page.getByLabel("Poem text").fill("Salt on the window;\nthe harbour hums.");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("dialog", { name: "Save as new version" }).getByRole("button", { name: "Save version" }).click();
  await expect(page.getByRole("link", { name: "Version 2 — see versions" })).toBeVisible();
  return page.url().split("/").at(-2)!;
}

test.describe("rights step-up", () => {
  test("transferring ownership asks for the password; the API refuses without it", async ({ page, creator, consoleGuard }) => {
    // The step-up round-trip answers 403 by design before the password is given.
    consoleGuard.allow(/status of 403 \(Forbidden\) \(http:\/\/[^)]*\/api\/v1\/artifacts\/[0-9a-f-]+\/rights/);
    const artifactId = await newPiece(page, `Harbour ${uid()}`);
    const rights = {
      ownershipKind: "transferred",
      copyrightHolder: "Harbour Press",
      owners: [{ name: "Harbour Press", sharePercent: 100, creatorId: null }],
      attributionRequired: true,
      derivativesAllowed: false,
    };

    // API: no password, or a wrong one, is refused with step_up_required.
    const bare = await page.request.put(`/api/v1/artifacts/${artifactId}/rights`, { data: rights });
    expect(bare.status()).toBe(403);
    expect((await bare.json()).error.code).toBe("step_up_required");
    const wrong = await page.request.put(`/api/v1/artifacts/${artifactId}/rights`, { data: { ...rights, password: "not-the-password" } });
    expect((await wrong.json()).error.code).toBe("step_up_required");

    // UI: saving a transfer opens the password prompt; the correct password completes it.
    await page.goto(`/creations/${artifactId}`);
    await page.getByRole("tab", { name: "Rights" }).click();
    // At a glance: plain and reassuring, from the stored record only.
    await expect(page.getByRole("heading", { name: "You own this Creation" })).toBeVisible();
    const glance = page.getByRole("list", { name: "What this record allows" });
    await expect(glance).toContainText("Personal use");
    await expect(glance.getByRole("button", { name: "Add a commercial license" })).toBeVisible();
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
    await expect(page.getByRole("heading", { name: "Ownership of this Creation was transferred" })).toBeVisible();

    // Still signed in as the same creator (the check didn't replace the session).
    expect((await page.request.get(`/api/v1/artifacts/${artifactId}`)).status()).toBe(200);
  });
});

test.describe("rights detail & history", () => {
  test("the Rights tab leads with the legal note and keeps a readable, filterable history", async ({ page, creator }) => {
    void creator;
    const id = await newPiece(page, `Tide chart ${uid()}`);
    // A license, then make it final and public: both land in the history.
    expect((await page.request.post(`/api/v1/artifacts/${id}/licenses`, { data: { licenseType: "editorial", licenseeName: "Harbour Times" } })).ok()).toBe(true);
    expect((await page.request.patch(`/api/v1/artifacts/${id}`, { data: { status: "final", privacy: "public" } })).ok()).toBe(true);

    await page.goto(`/creations/${id}?tab=rights`);
    await expect(page.getByRole("note").filter({ hasText: "don't by themselves establish legal ownership" })).toBeVisible();
    await expect(page.getByText("Contributors", { exact: true })).toBeVisible();
    await expect(page.getByText("Provenance", { exact: true })).toBeVisible();

    const history = page.getByRole("list", { name: "Rights events, newest first" });
    await expect(history.getByRole("listitem").first()).toContainText("Sharing changed: visibility private → public, status draft → final");
    await expect(history).toContainText("Editorial Use for Harbour Times recorded (draft)");
    await expect(history).toContainText(/Rights record created — .*, sole ownership/);

    await page.getByRole("navigation", { name: "Filter history" }).getByRole("button", { name: "Licenses" }).click();
    await expect(history.getByRole("listitem")).toHaveCount(1);
    await page.getByRole("navigation", { name: "Filter history" }).getByRole("button", { name: "Publication" }).click();
    await expect(history.getByRole("listitem")).toHaveCount(1);
    await expect(history).toContainText("Sharing changed");
  });
});
