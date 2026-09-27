import { expect, poemFromNote, test } from "./fixtures";

test.describe("Artifact transformation", () => {
  test.beforeEach(({ creator }) => void creator);

  test("adapt a chosen version, see what carries over, and land on the derivative linked to its source", async ({ page }) => {
    const { artifactId, noteTitle } = await poemFromNote(page);
    // A second version, so there's a version to choose.
    const art = (await (await page.request.get(`/api/v1/artifacts/${artifactId}`)).json()).artifact as { current_version_id: string; title: string };
    expect((await page.request.post(`/api/v1/artifacts/${artifactId}/versions`, { data: { content: "A quieter second draft.", baseVersionId: art.current_version_id, label: "Revised" } })).ok()).toBe(true);

    await page.goto(`/artifacts/${artifactId}`);
    await page.getByRole("link", { name: "Transform", exact: true }).click();
    // The Transform screen: forms that suit a poem first, every other form after.
    await expect(page.getByRole("heading", { name: "Transform", level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Suits this poem" })).toBeVisible();
    await page.getByRole("button", { name: /^Turn into lyrics/ }).click();
    const dialog = page.getByRole("dialog", { name: "Create a derivative" });
    await expect(dialog.getByText(/Turning it into Lyrics/)).toBeVisible();
    await expect(dialog.getByText(`From “${art.title}”`)).toBeVisible();
    await dialog.getByLabel("Version to adapt").selectOption({ label: "v1 Initial draft" });
    const carries = dialog.getByRole("region", { name: "What carries over" });
    await expect(carries).toContainText("1 piece of material it was made from.");
    await expect(carries).toContainText("private draft");

    await dialog.getByLabel("Anything to keep in mind? (optional)").fill("Make it singable.");
    await dialog.getByRole("button", { name: "Create derivative" }).click();

    await page.waitForURL((u) => /\/artifacts\/[0-9a-f-]{36}$/.test(u.pathname) && !u.pathname.includes(artifactId), { timeout: 45_000 });
    const source = page.getByRole("link", { name: `“${art.title}”` });
    await expect(source).toHaveAttribute("href", `/artifacts/${artifactId}`);

    await page.getByRole("tab", { name: "Rights" }).click();
    await expect(page.getByText(/Derived from “.*” \(v1\)/)).toBeVisible();
    // Lineage, in the Context view: source piece, the version it came from, and the material.
    await page.getByRole("link", { name: "Context", exact: true }).click();
    await page.getByRole("navigation", { name: "Context sections" }).getByRole("link", { name: /^Related/ }).click();
    const lineage = page.getByRole("list", { name: "Creative lineage, from sources to derivatives" });
    await expect(lineage).toContainText(art.title);
    await expect(lineage).toContainText(noteTitle);
  });
});
