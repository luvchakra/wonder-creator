import { expect, test, uid } from "./fixtures";

// Owner, 4 Oct 2026: "remove reference shelf" and "long press the items here to delete them" (My Creative Space).
test.describe("My Creative Space", () => {
  test("no Reference Shelf; press and hold a card to delete it, after asking; a tap still opens it", async ({ page, creator }) => {
    void creator;
    const keep = `Keep ${uid()}`;
    const gone = `Gone ${uid()}`;
    for (const title of [keep, gone]) await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title } });
    await page.goto("/materials");
    await expect(page.getByRole("link", { name: "Reference Shelf" })).toHaveCount(0);

    // Hold: asks first; Cancel keeps it.
    const card = page.getByRole("link", { name: new RegExp(gone) }).first();
    const box = (await card.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(800);
    await page.mouse.up();
    const ask = page.getByRole("dialog", { name: `Delete “${gone}”?` });
    await expect(ask).toBeVisible();
    await expect(page).toHaveURL(/\/materials$/);
    await ask.getByRole("button", { name: "Cancel" }).click();
    await expect(card).toBeVisible();

    // The context menu asks too; Delete removes it.
    await card.click({ button: "right" });
    await page.getByRole("dialog", { name: `Delete “${gone}”?` }).getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("link", { name: new RegExp(gone) })).toHaveCount(0);

    // A tap opens.
    await page.getByRole("link", { name: new RegExp(keep) }).first().click();
    await expect(page).toHaveURL(/\/creations\/[0-9a-f-]{36}/);
  });
});
