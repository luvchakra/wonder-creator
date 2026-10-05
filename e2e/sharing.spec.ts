import { expect, newCreator, test, uid, type Page } from "./fixtures";

async function pieceWithText(page: Page, title: string, content: string): Promise<string> {
  const res = await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title } });
  const art = (await res.json()).artifact as { id: string; current_version_id: string };
  expect((await page.request.post(`/api/v1/artifacts/${art.id}/versions`, { data: { content, baseVersionId: art.current_version_id, label: "Written" } })).ok()).toBe(true);
  return art.id;
}

test.describe("share, download and export", () => {
  test("private link: create, open signed out, download, revoke", async ({ page, creator, openContext }) => {
    void creator;
    test.setTimeout(120_000);
    const title = `Harbour lamps ${uid()}`;
    const id = await pieceWithText(page, title, "The lamps come on one by one.");
    await page.goto(`/creations/${id}`);

    // Downloads offer the formats that suit a poem.
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Download…" }).click();
    const formats = page.getByRole("dialog", { name: "Download" });
    await expect(formats.getByRole("listitem")).toHaveText(["Markdown (.md)", "Plain text (.txt)", "Web page (.html)"]);
    const download = page.waitForEvent("download");
    await formats.getByRole("button", { name: "Plain text (.txt)" }).click();
    expect((await download).suggestedFilename()).toMatch(/^harbour-lamps-.*\.txt$/);

    await page.getByRole("button", { name: "Share" }).click();
    await page.getByRole("link", { name: /Private links and people/ }).click();
    await expect(page).toHaveURL(new RegExp(`/creations/${id}/share$`));
    await expect(page.getByText("Nothing is shared yet.")).toBeVisible();

    await page.getByLabel("Allow downloads").first().click();
    await page.getByLabel("Name (optional)").fill("For the editor");
    await page.getByRole("button", { name: "Create link" }).click();
    const link = await page.getByLabel("Link", { exact: true }).inputValue();
    expect(link).toMatch(/\/s\/[A-Za-z0-9_-]{20,}$/);
    await expect(page.getByRole("list").filter({ hasText: "For the editor" })).toContainText("can download");

    // Someone signed out opens it: the piece, and downloads, but nothing else.
    const { page: guest } = await openContext("guest");
    await guest.goto(link);
    await expect(guest.getByRole("heading", { name: title })).toBeVisible();
    await expect(guest.getByText("The lamps come on one by one.")).toBeVisible();
    await expect(guest.getByRole("link", { name: "Markdown" })).toBeVisible();

    // Revoked links stop working.
    await page.getByRole("button", { name: "Revoke" }).click();
    await page.getByRole("dialog", { name: "Revoke this share?" }).getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByText("Nothing is shared yet.")).toBeVisible();
    await expect(page.getByText("Ended shares (1)")).toBeVisible();
    await guest.reload();
    await expect(guest.getByRole("heading", { name: "This link isn't available" })).toBeVisible();
    await expect(guest.getByText("The lamps come on one by one.")).toHaveCount(0);
  });

  test("share with a creator: they find it under Shared with you, and lose it when revoked", async ({ page, creator, openContext }) => {
    void creator;
    test.setTimeout(120_000);
    const title = `Tide tables ${uid()}`;
    const id = await pieceWithText(page, title, "Low water at six.");
    const { page: b } = await openContext("B");
    const creatorB = await newCreator(b, { name: `Ravi ${uid()}` });

    await page.goto(`/creations/${id}/share`);
    await page.getByLabel("Creator's handle").fill(`@${creatorB.handle}`);
    await page.getByRole("button", { name: "Share", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: `Shared with @${creatorB.handle}` })).toBeVisible();

    await b.goto("/materials?tab=shared");
    await b.getByRole("link", { name: "Shared with you" }).click();
    await b.getByRole("link", { name: new RegExp(title) }).click();
    await expect(b.getByText("Low water at six.")).toBeVisible();
    // Sharing isn't access to the piece itself.
    await b.goto(`/creations/${id}`);
    await expect(b.getByRole("heading", { name: title })).toHaveCount(0);

    await page.reload();
    await page.getByRole("button", { name: "Revoke" }).click();
    await page.getByRole("dialog", { name: "Revoke this share?" }).getByRole("button", { name: "Revoke" }).click();
    await expect(page.getByText("Nothing is shared yet.")).toBeVisible();
    await b.goto("/shared");
    await expect(b.getByText("Nothing shared with you yet")).toBeVisible();
  });
});
