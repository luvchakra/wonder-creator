import { expect, newCreator, test } from "./fixtures";

test.describe("Brand work profile", () => {
  test("opt into brand work; others see only the short summary", async ({ page, creator, openContext }) => {
    await page.goto("/settings?section=brand");
    await expect(page.getByRole("heading", { name: "Brand work", level: 2 })).toBeVisible();
    await page.getByLabel("Niches").fill("Slow travel");
    await page.getByLabel("Niches").press("Enter");
    await page.getByLabel("Deliverables").fill("Short film");
    await page.getByLabel("Deliverables").press("Enter");
    await page.getByLabel("Prior brand collaborations (private)").fill("Harbour Hotels");
    await page.getByLabel("Prior brand collaborations (private)").press("Enter");
    await page.getByRole("switch", { name: "Open to brand work" }).click();
    await page.getByRole("button", { name: "Save brand-work profile" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Brand-work profile saved." })).toBeVisible();

    const { page: other } = await openContext("other");
    await newCreator(other);
    await other.goto(`/creators/${creator.handle}`);
    const card = other.getByRole("region", { name: "Open to brand work" });
    await expect(card).toContainText("Slow travel");
    await expect(card).toContainText("Short film");
    await expect(other.getByText("Harbour Hotels")).toHaveCount(0);
  });
});
