import { expect, poemFromNote, test } from "./fixtures";

test.describe("Quality review & selective refinement", () => {
  test.beforeEach(({ creator }) => void creator);

  test("choose a suggestion, preview, regenerate, keep, then compare; set another aside", async ({ page }) => {
    const { artifactId } = await poemFromNote(page);
    // Quality lives in the Refine sheet (owner, 3 Oct 2026); #creativemind opens it, as the Palette's Refine does.
    await page.goto(`/creations/${artifactId}/studio#creativemind`);
    const quality = page.getByRole("region", { name: "Quality" });
    const suggestions = quality.getByRole("list", { name: "Suggestions" });
    await expect(suggestions).toContainText("Try a closer detail");
    await expect(suggestions).toContainText("Pacing");

    await quality.getByRole("checkbox", { name: /Try a closer detail/ }).check();
    await quality.getByRole("button", { name: "Preview 1 change" }).click();
    const editor = page.getByRole("region", { name: "Editor" });
    await expect(editor.getByText("Applying: Try a closer detail")).toBeVisible();
    // Original / proposed switch: read either whole, or just the changes.
    const show = editor.getByRole("radiogroup", { name: "Show" });
    await expect(show.getByRole("radio", { name: "Changes" })).toHaveAttribute("aria-checked", "true");
    await show.getByRole("radio", { name: "Proposed" }).click();
    await expect(editor.getByRole("article", { name: "Proposed" })).toBeVisible();
    await show.getByRole("radio", { name: /^Original/ }).click();
    await expect(editor.getByRole("article", { name: "Original" })).toBeVisible();
    await show.getByRole("radio", { name: "Changes" }).click();

    await editor.getByRole("button", { name: "Try another version" }).click();
    await expect(editor.getByText("Applying: Try a closer detail")).toBeVisible();
    await editor.getByRole("button", { name: "Keep revision" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved as v2 with: Try a closer detail." })).toBeVisible();

    // What changed and why is in the version history, with compare.
    await page.getByRole("link", { name: "Compare with the previous version" }).click();
    await expect(page).toHaveURL(new RegExp(`/creations/${artifactId}\\?tab=versions$`));
    await expect(page.getByText("Applied quality suggestions: Try a closer detail")).toBeVisible();
    await expect(page.getByRole("region", { name: "Compare versions" })).toBeVisible();
    await page.goto(`/creations/${artifactId}/studio#creativemind`);

    // The review is now for an earlier version; review again, then set a finding aside.
    await expect(quality.getByText(/From an earlier version/)).toBeVisible();
    await quality.getByRole("button", { name: "Review again" }).click();
    await expect(quality.getByText(/From an earlier version/)).toHaveCount(0);
    await quality.getByRole("button", { name: "Set aside “Pacing”" }).click();
    await expect(quality.getByText("Applied or set aside (1)")).toBeVisible();
  });
});
