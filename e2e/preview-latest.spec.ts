import { expect, test, uid } from "./fixtures";

// Owner, 5 Oct 2026: "I edited lyrics but when I look at preview it still shows old text — make sure preview takes
// latest data". Preview shows what Publish would publish (the latest version), so words written since the last version
// are saved as one first; and a draft still unsaved is named on Preview rather than silently left out.
test.describe("Preview takes the latest words", () => {
  test("words typed since the last version are saved, then previewed", async ({ page, creator }) => {
    void creator;
    const res = await page.request.post("/api/v1/artifacts", { data: { artifactType: "lyrics", title: `make a song ${uid()}`, content: "test" } });
    const id = ((await res.json()) as { artifact: { id: string } }).artifact.id;
    await page.goto(`/creations/${id}/write`);
    await page.getByRole("button", { name: "Write" }).click();
    const fresh = `रात गहरी हो ${uid()}\nतो यूं करना`;
    await page.getByRole("textbox").last().fill(fresh);
    await expect(page.getByText("Autosaved").first()).toBeVisible({ timeout: 10_000 });

    // A draft left unsaved is named on Preview (opened directly, not through the button).
    await page.goto(`/creations/${id}/preview`);
    await expect(page.getByRole("status").filter({ hasText: "aren’t saved as a version yet" })).toBeVisible();
    await page.goBack();

    // The Preview button saves the newer words as a version, then shows them.
    await page.getByRole("link", { name: "Preview", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/creations/${id}/preview$`));
    await expect(page.getByText(fresh.split("\n")[0]!).first()).toBeVisible();
    await expect(page.getByText("test", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("status").filter({ hasText: "aren’t saved as a version yet" })).toHaveCount(0);
    const versions = (await (await page.request.get(`/api/v1/artifacts/${id}/versions`)).json()) as { versions: Array<{ content: string; label: string }> };
    expect(versions.versions[0]).toMatchObject({ content: fresh, label: "Before preview" });
  });
});
