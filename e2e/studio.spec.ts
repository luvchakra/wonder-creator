import { expect, poemFromNote, test, type Page } from "./fixtures";

async function openStudio(page: Page, artifactId: string) {
  await page.goto(`/creations/${artifactId}/studio`);
  await expect(page.getByRole("region", { name: "Editor" })).toBeVisible();
  // It opens reading over the cover; Write (the Writing page) or the pen (the Studio) opens the text.
  const pen = page.getByRole("button", { name: /^(Edit the text|Write)$/ }).first();
  if (await pen.isVisible()) await pen.click();
}

/** Refine lives in a sheet off the canvas (owner, 3 Oct 2026: "keep it minimal, focus on content"): More → Refine. */
async function openRefine(page: Page) {
  await page.getByRole("button", { name: "More", exact: true }).click();
  await page.getByRole("dialog", { name: "Save, version and publish" }).getByRole("button", { name: /Refine with CreativeMind/ }).click();
  await expect(page.getByRole("dialog", { name: "Refine with CreativeMind" })).toBeVisible();
}

test.describe("Studio, versions and lineage", () => {
  test.beforeEach(({ creator }) => void creator);

  test("refine with CreativeMind: Improve → proposal → Keep revision adds a version", async ({ page }) => {
    const { artifactId } = await poemFromNote(page);
    await openStudio(page, artifactId);
    await expect(page.getByRole("link", { name: "Version 1 — see versions" })).toBeVisible();
    const before = await page.getByLabel("Poem text").inputValue();
    expect(before.length).toBeGreaterThan(0);

    await openRefine(page);
    await page.getByRole("region", { name: "Refine with CreativeMind" }).getByRole("button", { name: /Improve this/ }).click();
    await expect(page.getByText("CreativeMind suggested a revision. Your current version stays in history either way.")).toBeVisible({ timeout: 45_000 });
    // The proposal shows what would be added.
    await expect(page.getByRole("region", { name: "Editor" }).getByText("(Revised offline: improve.)")).toBeVisible();
    await page.getByRole("button", { name: "Keep revision" }).click();

    await expect(page.getByRole("link", { name: "Version 2 — see versions" })).toBeVisible();
    await expect(page.getByLabel("Poem text")).toHaveValue(/\(Revised offline: improve\.\)/);

    await page.goto(`/creations/${artifactId}`);
    await expect(page.getByRole("tab", { name: "Versions (2)" })).toBeVisible();
    await expect(page.getByText("v2 ", { exact: false }).first()).toBeVisible();
    await page.getByRole("tab", { name: "Versions (2)" }).click();
    const history = page.getByRole("list", { name: "Version history" });
    await expect(history.getByRole("listitem")).toHaveCount(2);
    await expect(history.getByRole("listitem").first()).toContainText("Current");
    await expect(history.getByRole("listitem").first()).toContainText("CreativeMind");
  });

  test("a discarded proposal changes nothing", async ({ page }) => {
    const { artifactId } = await poemFromNote(page);
    await openStudio(page, artifactId);
    await openRefine(page);
    await page.getByRole("button", { name: /Make it shorter/ }).click();
    await expect(page.getByRole("button", { name: "Discard" })).toBeVisible({ timeout: 45_000 });
    await page.getByRole("button", { name: "Discard" }).click();
    await expect(page.getByLabel("Poem text")).toBeVisible();
    await expect(page.getByRole("link", { name: "Version 1 — see versions" })).toBeVisible();
    await page.goto(`/creations/${artifactId}`);
    await expect(page.getByRole("tab", { name: "Versions (1)" })).toBeVisible();
  });

  test("editing and saving creates v2; restoring v1 creates v3; compare shows the diff", async ({ page }) => {
    const { artifactId } = await poemFromNote(page);
    await openStudio(page, artifactId);
    const editor = page.getByLabel("Poem text");
    const original = await editor.inputValue();
    const added = "And the harbour answers in its own slow tongue.";
    await editor.fill(`${original}\n${added}`);
    // Edits autosave as a draft (no version yet) and survive a reload.
    await expect(page.getByText("Autosaved").first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole("region", { name: "Editor" })).toContainText(added);
    expect(((await (await page.request.get(`/api/v1/artifacts/${artifactId}/versions`)).json()) as { versions: unknown[] }).versions).toHaveLength(1);
    await page.getByLabel("Title").fill("Harbour Psalm");
    await page.getByLabel("Title").blur();
    // A version is a checkpoint the creator chooses.
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("dialog", { name: "Save, version and publish" }).getByRole("button", { name: /^Save version/ }).click();
    const sheet = page.getByRole("dialog", { name: "Save as new version" });
    await expect(sheet.getByLabel("Version name")).toHaveValue("Poem (Harbour Psalm)");
    await sheet.getByRole("button", { name: "Save version" }).click();
    await expect(page.getByRole("link", { name: "Version 2 — see versions" })).toBeVisible();

    await page.getByRole("link", { name: "Back to Creation" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Harbour Psalm" })).toBeVisible();
    await expect(page.getByRole("article")).toContainText(added);
    await page.getByRole("tab", { name: "Versions (2)" }).click();

    // Compare v1 (left) with v2 (right): the added line is marked as added.
    const compare = page.getByRole("region", { name: "Compare versions" });
    await expect(compare.getByLabel("Compare")).toHaveValue(/.+/);
    await expect(compare.getByText(`Added: ${added}`)).toBeVisible();
    await expect(compare.getByText(/^Added: /)).toHaveCount(1);

    // Restore v1 as a new version.
    const history = page.getByRole("list", { name: "Version history" });
    const v1 = history.getByRole("listitem").filter({ hasText: /^v1 / });
    await v1.getByRole("button", { name: "Restore as new version" }).click();
    await expect(page.getByRole("tab", { name: "Versions (3)" })).toBeVisible();
    await expect(history.getByRole("listitem")).toHaveCount(3);
    const current = history.getByRole("listitem").filter({ hasText: "Current" });
    await expect(current).toContainText("v3");
    await expect(current).toContainText("Restored");
    await expect(page.getByRole("article")).not.toContainText(added);

    // Compare the saved edit (v2) with the restored version (v3): the line is removed.
    await compare.getByLabel("Compare").selectOption({ label: "v2 Poem (Harbour Psalm)" });
    await compare.getByLabel("with").selectOption({ index: 0 });
    await expect(compare.getByText(`Removed: ${added}`)).toBeVisible();

    // The dedicated compare view: single view, before / after, and swipe.
    await compare.getByLabel("Compare").selectOption({ index: 0 });
    await compare.getByLabel("with").selectOption({ index: 1 });
    await compare.getByRole("link", { name: /Open the compare view/ }).click();
    await expect(page.getByRole("heading", { name: "Compare versions", level: 1 })).toBeVisible();
    const modes = page.getByRole("radiogroup", { name: "Compare as" });
    await expect(page.getByRole("region", { name: "Changes" })).toBeVisible();
    await modes.getByRole("radio", { name: "Before / After" }).click();
    await expect(page.getByRole("article", { name: /^Before: v/ })).toBeVisible();
    await expect(page.getByRole("article", { name: /^After: v/ })).toBeVisible();
    await modes.getByRole("radio", { name: "Before / After" }).press("ArrowRight");
    await expect(modes.getByRole("radio", { name: "Swipe" })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("region", { name: "Swipe between before and after" })).toBeVisible();
  });

  test("lineage shows the source material", async ({ page }) => {
    const { artifactId, noteTitle, materialId } = await poemFromNote(page);
    await page.goto(`/creations/${artifactId}`);
    await expect(page.getByText(/Started .* from 1 material/)).toBeVisible();
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Context" }).click();
    await page.getByRole("navigation", { name: "Context sections" }).getByRole("link", { name: /^Related/ }).click();
    const lineage = page.getByRole("list", { name: "Creative lineage, from sources to derivatives" });
    await expect(lineage).toBeVisible();
    const source = lineage.getByRole("link", { name: new RegExp(noteTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
    await expect(source).toHaveAttribute("href", `/materials/${materialId}`);
    await expect(source).toContainText("created from");

    // And the material knows where it was used.
    await source.click();
    await expect(page).toHaveURL(new RegExp(`/materials/${materialId}$`));
    await expect(page.getByText("in 1 Creation")).toBeVisible();
    await page.getByRole("button", { name: "Details" }).click();
    const usedIn = page.getByRole("dialog", { name: "Details" }).getByRole("region", { name: "Used in" });
    await expect(usedIn.getByRole("link")).toHaveAttribute("href", `/creations/${artifactId}`);
  });

  test("the canvas is the writing: no panels below it, the full text scrolls over the cover, and it opens on its own page", async ({ page }) => {
    const { artifactId } = await poemFromNote(page);
    // A poem is writing: the Studio address forwards to its Writing page.
    await page.goto(`/creations/${artifactId}/studio`);
    await expect(page).toHaveURL(new RegExp(`/creations/${artifactId}/write$`));
    const editor = page.getByRole("region", { name: "Editor" });
    await expect(editor).toBeVisible();
    // Nothing competes with the canvas on the page.
    await expect(page.getByRole("region", { name: "Quality" })).toHaveCount(0);
    await expect(page.getByPlaceholder("Describe what to change…")).toHaveCount(0);
    // The palette's Refine still reaches it (#creativemind opens the sheet).
    await page.goto(`/creations/${artifactId}/write#creativemind`);
    await expect(page.getByRole("dialog", { name: "Refine with CreativeMind" })).toBeVisible();
    await page.keyboard.press("Escape");
    // Reading on its own page: just the words, and one way back.
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("dialog", { name: "Save, version and publish" }).getByRole("button", { name: /Read it on its own/ }).click();
    await expect(page).toHaveURL(new RegExp(`/creations/${artifactId}/read$`));
    await expect(page.getByRole("article").getByRole("heading", { level: 1 })).toBeVisible();
    await page.getByRole("link", { name: "Close reading" }).click();
    await expect(page).toHaveURL(new RegExp(`/creations/${artifactId}/(?:studio|write)$`));
  });
});
