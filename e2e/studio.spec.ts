import { expect, poemFromNote, test, type Page } from "./fixtures";

async function openStudio(page: Page, artifactId: string) {
  await page.goto(`/artifacts/${artifactId}/studio`);
  await expect(page.getByRole("region", { name: "Editor" })).toBeVisible();
}

test.describe("Studio, versions and lineage", () => {
  test.beforeEach(({ creator }) => void creator);

  test("refine with CreativeMind: Improve → proposal → Keep revision adds a version", async ({ page }) => {
    const { artifactId } = await poemFromNote(page);
    await openStudio(page, artifactId);
    await expect(page.getByText("Poem · v1")).toBeVisible();
    const before = await page.getByLabel("Poem text").inputValue();
    expect(before.length).toBeGreaterThan(0);

    await page.getByRole("region", { name: "Refine with CreativeMind" }).getByRole("button", { name: /Improve this/ }).click();
    await expect(page.getByText("CreativeMind suggested a revision. Your current version stays in history either way.")).toBeVisible({ timeout: 45_000 });
    // The proposal shows what would be added.
    await expect(page.getByRole("region", { name: "Editor" }).getByText("(Revised offline: improve.)")).toBeVisible();
    await page.getByRole("button", { name: "Keep revision" }).click();

    await expect(page.getByText("Poem · v2")).toBeVisible();
    await expect(page.getByLabel("Poem text")).toHaveValue(/\(Revised offline: improve\.\)/);

    await page.goto(`/artifacts/${artifactId}`);
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
    await page.getByRole("button", { name: /Make it shorter/ }).click();
    await expect(page.getByRole("button", { name: "Discard" })).toBeVisible({ timeout: 45_000 });
    await page.getByRole("button", { name: "Discard" }).click();
    await expect(page.getByLabel("Poem text")).toBeVisible();
    await expect(page.getByText("Poem · v1")).toBeVisible();
    await page.goto(`/artifacts/${artifactId}`);
    await expect(page.getByRole("tab", { name: "Versions (1)" })).toBeVisible();
  });

  test("editing and saving creates v2; restoring v1 creates v3; compare shows the diff", async ({ page }) => {
    const { artifactId } = await poemFromNote(page);
    await openStudio(page, artifactId);
    const editor = page.getByLabel("Poem text");
    const original = await editor.inputValue();
    const added = "And the harbour answers in its own slow tongue.";
    await editor.fill(`${original}\n${added}`);
    await expect(page.getByText("Poem · v1 · unsaved changes")).toBeVisible();
    await page.getByLabel("Title").fill("Harbour Psalm");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByText(/Poem · v2 · saved/)).toBeVisible();

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
    await compare.getByLabel("Compare").selectOption({ label: "v2 Revised" });
    await compare.getByLabel("with").selectOption({ index: 0 });
    await expect(compare.getByText(`Removed: ${added}`)).toBeVisible();
  });

  test("lineage shows the source material", async ({ page }) => {
    const { artifactId, noteTitle, materialId } = await poemFromNote(page);
    await page.goto(`/artifacts/${artifactId}`);
    await expect(page.getByText("Created from")).toBeVisible();
    await expect(page.getByText("1 material")).toBeVisible();
    await page.getByRole("link", { name: "Context", exact: true }).click();
    await page.getByRole("navigation", { name: "Context sections" }).getByRole("link", { name: /^Related/ }).click();
    const lineage = page.getByRole("list", { name: "Creative lineage, from sources to derivatives" });
    await expect(lineage).toBeVisible();
    const source = lineage.getByRole("link", { name: new RegExp(noteTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
    await expect(source).toHaveAttribute("href", `/space/materials/${materialId}`);
    await expect(source).toContainText("created from");

    // And the material knows where it was used.
    await source.click();
    await expect(page).toHaveURL(new RegExp(`/space/materials/${materialId}$`));
    await page.getByRole("tab", { name: "Usage (1)" }).click();
    await expect(page.getByRole("heading", { name: "Used in" })).toBeVisible();
    const usedIn = page.getByRole("complementary").locator("section").filter({ has: page.getByRole("heading", { name: "Used in" }) });
    await expect(usedIn.getByRole("link")).toHaveAttribute("href", `/artifacts/${artifactId}`);
  });
});
