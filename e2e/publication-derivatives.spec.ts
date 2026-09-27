import { expect, test, uid } from "./fixtures";

test.describe("Publication derivatives", () => {
  test("make a platform adaptation from a piece: it's a real derivative that links back to its source version", async ({ page, creator }) => {
    void creator;
    test.setTimeout(120_000);
    const title = `Low tide ${uid()}`;
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "short_film", title } })).json()).artifact as { id: string; current_version_id: string };
    await page.request.post(`/api/v1/artifacts/${art.id}/versions`, { data: { content: "EXT. BEACH - DAWN\nA girl waits for the tide.", baseVersionId: art.current_version_id, label: "Written" } });

    await page.goto(`/artifacts/${art.id}`);
    await page.getByRole("link", { name: "Derivatives" }).click();
    await expect(page.getByRole("heading", { name: "Derivatives", level: 1 })).toBeVisible();
    await expect(page.getByRole("region", { name: "Source" })).toContainText("v2");
    await page.getByRole("button", { name: "Make youtube description" }).click();
    await expect(page.getByText(/for YouTube\. Review it before publishing/).first()).toBeVisible();

    const made = page.getByRole("region", { name: "Derivatives of this piece" }).getByRole("listitem").filter({ hasText: "Video Description" }).first();
    await expect(made).toContainText("For YouTube");
    await expect(made).toContainText("from v2");
    await expect(made).toContainText("Not published yet.");
    await made.getByRole("link", { name: /^Review / }).click();
    await expect(page).not.toHaveURL(new RegExp(`/artifacts/${art.id}$`));
    // The derivative links back to its source.
    await page.getByRole("tab", { name: "Lineage" }).click();
    await expect(page.getByText(title).first()).toBeVisible();
  });
});
