import { expect, poemFromNote, test } from "./fixtures";

test.describe("Artifact transformation", () => {
  test.beforeEach(({ creator }) => void creator);

  test("adapt a chosen version, see what carries over, and land on the derivative linked to its source", async ({ page }) => {
    const { artifactId, noteTitle } = await poemFromNote(page);
    // A second version, so there's a version to choose.
    const art = (await (await page.request.get(`/api/v1/artifacts/${artifactId}`)).json()).artifact as { current_version_id: string; title: string };
    expect((await page.request.post(`/api/v1/artifacts/${artifactId}/versions`, { data: { content: "A quieter second draft.", baseVersionId: art.current_version_id, label: "Revised" } })).ok()).toBe(true);

    await page.goto(`/artifacts/${artifactId}`);
    await page.getByRole("button", { name: "More actions" }).click();
    await page.getByRole("menuitem", { name: "Transform / create derivative" }).click();
    const dialog = page.getByRole("dialog", { name: "Create a derivative" });
    await expect(dialog.getByText(`From “${art.title}”`)).toBeVisible();
    await dialog.getByLabel("Version to adapt").selectOption({ label: "v1 Initial draft" });
    const carries = dialog.getByRole("region", { name: "What carries over" });
    await expect(carries).toContainText("1 piece of material it was made from.");
    await expect(carries).toContainText("private draft");

    await dialog.getByRole("button", { name: /Turn into lyrics/ }).click();
    await dialog.getByLabel("Anything to keep in mind? (optional)").fill("Make it singable.");
    await dialog.getByRole("button", { name: "Create derivative" }).click();

    await page.waitForURL((u) => /\/artifacts\/[0-9a-f-]{36}$/.test(u.pathname) && !u.pathname.includes(artifactId), { timeout: 45_000 });
    const source = page.getByRole("link", { name: `“${art.title}”` });
    await expect(source).toHaveAttribute("href", `/artifacts/${artifactId}`);

    // Lineage: source piece, the version it came from, and the material.
    await page.getByRole("tab", { name: "Lineage" }).click();
    const lineage = page.getByRole("list", { name: "Creative lineage, from sources to derivatives" });
    await expect(lineage).toContainText(art.title);
    await expect(lineage).toContainText(noteTitle);
    await page.getByRole("tab", { name: "Rights" }).click();
    await expect(page.getByText(/Derived from “.*” \(v1\)/)).toBeVisible();
  });
});
