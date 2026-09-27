import { expect, test, uid } from "./fixtures";

test.describe("Creative Palette", () => {
  test("shows the current Creation's actions first, then destinations and quick actions", async ({ page, creator }) => {
    void creator;
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title: `Harbour ${uid()}` } })).json()).artifact as { id: string };
    await page.goto(`/artifacts/${art.id}`);
    await page.getByRole("button", { name: "Open Creative Palette" }).click();
    const palette = page.getByRole("dialog", { name: "Creative Palette" });
    const creation = palette.getByRole("navigation", { name: "This Creation" });
    await expect(creation.getByRole("button", { name: /Refine/ })).toBeVisible();
    await expect(palette.getByRole("navigation", { name: "Destinations" }).getByRole("button", { name: "Creation" })).toHaveAttribute("aria-current", "page");
    await expect(palette.getByRole("navigation", { name: "Create" }).getByRole("button", { name: /meTalk/ })).toBeVisible();
    await creation.getByRole("button", { name: /Transform/ }).click();
    await expect(page).toHaveURL(new RegExp(`/artifacts/${art.id}/transform$`));
    // Leaving the Creation clears its actions.
    await page.goto("/huddles");
    await page.getByRole("button", { name: "Open Creative Palette" }).click();
    await expect(palette.getByRole("navigation", { name: "This Creation" })).toHaveCount(0);
    await expect(palette.getByRole("button", { name: "Huddles" })).toHaveAttribute("aria-current", "page");
  });
});
