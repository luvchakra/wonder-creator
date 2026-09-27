import { expect, test } from "./fixtures";

test.describe("CreatorMarket foundation", () => {
  test("stays off: with the feature flag off, the market API doesn't exist and nothing shows", async ({ page, creator }) => {
    void creator;
    expect((await page.request.get("/api/v1/market/listings")).status()).toBe(404);
    expect((await page.request.post("/api/v1/market/listings", { data: { artifactId: "00000000-0000-4000-8000-000000000000", title: "x", licenseType: "personal" } })).status()).toBe(404);
    expect((await page.request.post("/api/v1/market/listings/00000000-0000-4000-8000-000000000000/state", { data: { state: "listed" } })).status()).toBe(404);
    await page.goto("/");
    await page.getByRole("button", { name: "Open Creative Palette" }).click();
    await expect(page.getByRole("dialog", { name: "Creative Palette" }).getByText(/market/i)).toHaveCount(0);
  });
});
