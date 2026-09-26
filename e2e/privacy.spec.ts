import { expect, newCreator, saveNote, test, uid, type Page } from "./fixtures";

async function newPiece(page: Page, title: string, text: string): Promise<string> {
  await page.goto("/space");
  await page.getByRole("button", { name: "New", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Start a new piece" });
  await dialog.getByLabel("Kind of piece").selectOption({ label: "Poem" });
  await dialog.getByLabel("Title").fill(title);
  await dialog.getByRole("button", { name: "Open Studio" }).click();
  await page.waitForURL(/\/artifacts\/[0-9a-f-]{36}\/studio$/);
  await page.getByLabel("Poem text").fill(text);
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(page.getByText(/Poem · v\d · saved/)).toBeVisible();
  return page.url().split("/").at(-2)!;
}

async function expectNotFound(page: Page, path: string) {
  await page.goto(path);
  await expect(page.getByRole("heading", { name: "We couldn't find that" })).toBeVisible();
}

test.describe("privacy boundary", () => {
  test("private work is invisible to others until it is marked final and public", async ({ page: a, creator: creatorA, openContext }) => {
    const title = `Night Ferry ${uid()}`;
    const body = "The ferry leaves at nine;\nthe harbour keeps its lamps.";
    const artifactId = await newPiece(a, title, body);
    const materialId = await saveNote(a, `Private sketchbook line ${uid()}`);

    const { page: b } = await openContext("B");
    await newCreator(b);

    // B can't open A's private artifact (or its studio) or A's material.
    await expectNotFound(b, `/artifacts/${artifactId}`);
    await expectNotFound(b, `/space/materials/${materialId}`);
    await b.goto(`/artifacts/${artifactId}/studio`);
    await expect(b.getByRole("heading", { name: "We couldn't find that" })).toBeVisible();
    // Nor through the API.
    expect((await b.request.get(`/api/v1/artifacts/${artifactId}`)).status()).toBe(404);
    expect((await b.request.get(`/api/v1/materials/${materialId}`)).status()).toBe(404);

    // Search never surfaces A's private work to B, not even as a count or a snippet.
    const probe = await (await b.request.get(`/api/v1/search?q=${encodeURIComponent(title)}`)).json();
    expect(JSON.stringify(probe)).not.toContain(artifactId);
    await b.goto(`/search?q=${encodeURIComponent(title)}`);
    await expect(b.getByRole("heading", { name: /Nothing found for/ })).toBeVisible();

    // A's profile shows no public work to B.
    await b.goto(`/creators/${creatorA.handle}`);
    await expect(b.getByRole("heading", { name: "No public work yet" })).toBeVisible();
    await expect(b.getByText(title)).toHaveCount(0);

    // A marks it final + public (public alone would keep a draft private).
    await a.goto(`/artifacts/${artifactId}`);
    await a.getByRole("button", { name: "Share" }).click();
    const share = a.getByRole("dialog", { name: "Share" });
    const warning = share.getByText("Drafts stay private even when set to public — mark it final to share it.");
    await share.getByRole("switch", { name: "Public" }).click();
    await expect(warning).toBeVisible();
    await share.getByRole("switch", { name: "Mark as final" }).click();
    await expect(warning).toBeHidden();
    await expect(share.getByRole("switch", { name: "Mark as final" })).toHaveAttribute("aria-checked", "true");
    await expect(share.getByRole("switch", { name: "Public" })).toHaveAttribute("aria-checked", "true");
    await share.getByRole("button", { name: "Save" }).click();
    await expect(share).toBeHidden();
    await expect(a.getByText(/v\d Final/)).toBeVisible();
    await expect(a.getByText("Public", { exact: true }).first()).toBeVisible();

    // B now sees it on A's profile and can read it, without owner controls.
    await b.goto(`/creators/${creatorA.handle}`);
    await expect(b.getByRole("heading", { name: "Selected work" })).toBeVisible();
    await b.getByRole("link").filter({ hasText: title }).first().click();
    await expect(b).toHaveURL(new RegExp(`/artifacts/${artifactId}$`));
    await expect(b.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(b.getByRole("article")).toContainText("the harbour keeps its lamps.");
    await expect(b.getByRole("link", { name: "Edit" })).toHaveCount(0);
    await expect(b.getByRole("button", { name: "Share" })).toHaveCount(0);
    await expect(b.getByRole("button", { name: "More actions" })).toHaveCount(0);
    // The studio is owner-only: B is sent back to the read-only view.
    await b.goto(`/artifacts/${artifactId}/studio`);
    await expect(b).toHaveURL(new RegExp(`/artifacts/${artifactId}$`));
    // Once public and final, search finds it for B too.
    await b.goto(`/search?q=${encodeURIComponent(title)}&type=creations`);
    await expect(b.getByRole("region", { name: "Creations" }).getByRole("link", { name: new RegExp(title) })).toContainText("By another creator");
    // The source material stays private.
    await expectNotFound(b, `/space/materials/${materialId}`);
  });
});

test("Share dialog: Cancel discards unsaved changes", async ({ page, creator }) => {
  void creator;
  const artifactId = await newPiece(page, `Draft ${uid()}`, "A line.");
  await page.goto(`/artifacts/${artifactId}`);
  await page.getByRole("button", { name: "Share" }).click();
  let share = page.getByRole("dialog", { name: "Share" });
  await share.getByRole("switch", { name: "Public" }).click();
  await expect(share.getByRole("switch", { name: "Public" })).toHaveAttribute("aria-checked", "true");
  await share.getByRole("button", { name: "Cancel" }).click();
  await expect(share).toBeHidden();
  await expect(page.getByText("Private", { exact: true }).first()).toBeVisible();

  // Re-opening must show the saved state (private), not the cancelled toggle.
  await page.getByRole("button", { name: "Share" }).click();
  share = page.getByRole("dialog", { name: "Share" });
  await expect(share.getByRole("switch", { name: "Public" })).toHaveAttribute("aria-checked", "false");
});
