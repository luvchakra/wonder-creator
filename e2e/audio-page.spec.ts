import { expect, fakeMicrophone, test } from "./fixtures";

// Creation pages, step 3 (docs/ui-redesign/creation-pages.md): Audio opens a page built for a recording and its words.
test.describe("Audio page", () => {
  test("Make a new Creation › Audio: record, keep the take (a version), words below, record again keeps the first", async ({ page, creator }) => {
    void creator;
    await fakeMicrophone(page, true);
    await page.goto("/");
    await page.getByRole("button", { name: "Open Creative Palette" }).click();
    await page.getByRole("dialog", { name: "Creative Palette" }).getByRole("button", { name: "Create" }).click();
    await page.getByRole("dialog", { name: "Make a new Creation" }).getByRole("button", { name: /Audio/ }).click();
    await expect(page).toHaveURL(/\/creations\/[0-9a-f-]{36}\/audio$/);
    const id = page.url().match(/creations\/([0-9a-f-]{36})/)![1];

    // Empty: one line, and Record is the page's one primary action. Listen and Download wait for a take.
    const editor = page.getByRole("region", { name: "Editor" });
    await expect(editor.getByText("Your voice, first")).toBeVisible();
    await expect(page.getByRole("link", { name: "Listen" })).toHaveCount(0);
    await editor.getByRole("textbox").fill("Platform 3, before the first train.");

    await page.getByRole("button", { name: "Record", exact: true }).click();
    const rec = page.getByRole("dialog", { name: "Record" });
    await expect(rec.getByRole("button", { name: "Stop" })).toBeEnabled();
    await page.waitForTimeout(1500);
    await rec.getByRole("button", { name: "Stop" }).click();
    await expect(rec.getByText(/^Take · 0:0\d$/)).toBeVisible();
    await rec.getByRole("button", { name: "Keep this take" }).click();
    await expect(rec).toBeHidden({ timeout: 30_000 });

    // The take plays above the words; keeping it was a version carrying the words as they were.
    await expect(editor.getByRole("button", { name: "Play the recording" })).toBeEnabled();
    await expect(page.getByRole("link", { name: "Listen" })).toHaveAttribute("href", `/creations/${id}/preview`);
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeVisible();
    await expect(editor.getByRole("textbox")).toHaveValue("Platform 3, before the first train.");

    // Record again: a new take; the first stays a Material and in the versions.
    await page.getByRole("button", { name: "Record again" }).click();
    const again = page.getByRole("dialog", { name: "Record again" });
    await page.waitForTimeout(1200);
    await again.getByRole("button", { name: "Stop" }).click();
    await again.getByRole("button", { name: "Keep this take" }).click();
    await expect(again).toBeHidden({ timeout: 30_000 });
    const versions = (await (await page.request.get(`/api/v1/artifacts/${id}/versions`)).json()) as { versions: Array<{ label: string; content: string }> };
    expect(versions.versions.map((v) => v.label)).toEqual(expect.arrayContaining(["First take", "New take"]));

    // Someone else's recording can't be used; the Studio address forwards here.
    const r = await page.request.post(`/api/v1/artifacts/${id}/audio`, { data: { materialId: "00000000-0000-4000-8000-000000000000", content: "" } });
    expect(r.status()).toBe(422);
    await page.goto(`/creations/${id}/studio`);
    await expect(page).toHaveURL(new RegExp(`/creations/${id}/audio$`));
  });
});
