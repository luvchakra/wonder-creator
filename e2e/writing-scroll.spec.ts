import { expect, test, uid } from "./fixtures";

// Owner, 5 Oct 2026: "last few lines not visible behind" — the Writing page's words scroll in a canvas the bottom bar
// floats over. Scrolled to the end, the last line sits clear of the bar (Write · Working Table) on a phone.
test.describe("Writing page: the last lines", () => {
  test("scrolled to the end, the last line is above the bottom bar @mobile", async ({ page, creator }) => {
    void creator;
    const last = `ना सितारा होता है कोई ${uid()}`;
    const lines = Array.from({ length: 40 }, (_, i) => `line ${i + 1} of the song`);
    // As on the owner's screen: a Room's Lyrics part, so the page also says which Room it belongs to above the words.
    await page.goto("/rooms?new=1");
    const create = page.getByRole("dialog", { name: "New Creative Room" });
    await create.getByLabel("Name").fill(`make a song ${uid()}`);
    await create.getByLabel(/^Song/).check();
    await create.getByLabel("Already underway").check();
    await create.getByRole("button", { name: "Create Creative Room" }).click();
    await expect(page).toHaveURL(/\/rooms\/[0-9a-f-]{36}$/);
    const work = page.getByRole("region", { name: "The work" });
    await work.getByRole("button", { name: "Lyrics actions" }).click();
    await page.getByRole("menuitem", { name: "Join this part" }).click();
    await work.getByRole("button", { name: "Lyrics actions" }).click();
    await page.getByRole("menuitem", { name: "Start the Creation" }).click();
    await expect(page).toHaveURL(/\/write$/);
    const id = page.url().match(/creations\/([0-9a-f-]{36})/)![1];
    const art = (await (await page.request.get(`/api/v1/artifacts/${id}`)).json()).artifact as { current_version_id: string };
    await page.request.post(`/api/v1/artifacts/${id}/versions`, { data: { content: [...lines, last].join("\n"), baseVersionId: art.current_version_id, label: "Words" } });
    await page.reload();
    const reader = page.getByRole("region", { name: "Editor" }).locator("[aria-label$=', read']");
    await reader.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    const lastLine = page.getByText(last);
    await expect(lastLine).toBeVisible();
    const bar = page.getByRole("button", { name: "Write" });
    const [lineBox, barBox] = [await lastLine.boundingBox(), await bar.boundingBox()];
    expect(lineBox!.y + lineBox!.height).toBeLessThan(barBox!.y);

    // While writing too: the editor's last line can scroll clear of the bar.
    await bar.click();
    const editor = page.getByRole("textbox").last();
    await editor.evaluate((el) => el.scrollTo(0, el.scrollHeight));
    const done = page.getByRole("button", { name: "Done" });
    const room = await editor.evaluate((el) => parseFloat(getComputedStyle(el).paddingBottom));
    const doneBox = await done.boundingBox();
    const editorBox = await editor.boundingBox();
    // The text ends `room` px above the editor's bottom edge — above the bar.
    expect(editorBox!.y + editorBox!.height - room).toBeLessThanOrEqual(doneBox!.y + 4);
  });
});
