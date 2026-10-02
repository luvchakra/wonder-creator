import { expect, saveNote, test, uid } from "./fixtures";

test.describe("contextual image generation", () => {
  test.beforeEach(({ creator }) => void creator);

  test("is honest when image generation isn't connected, and never starts work on a lookup", async ({ page }) => {
    const id = await saveNote(page, `Grandmother's kitchen at dawn ${uid()}`);
    await page.goto(`/materials/${id}`);
    const section = page.getByRole("region", { name: "Ways this could look" });
    await expect(section.getByText("Image generation isn't connected.")).toBeVisible();
    await expect(section.getByRole("button", { name: "Create visual directions" })).toHaveCount(0);

    // The API agrees: nothing stored, nothing started, no fake images.
    const lookup = await page.request.post("/api/v1/image-generations", { data: { materialIds: [id], purpose: "explore", lookupOnly: true } });
    expect(await lookup.json()).toEqual({ state: "none", available: false });
    const start = await page.request.post("/api/v1/image-generations", { data: { materialIds: [id], purpose: "explore" } });
    expect(await start.json()).toEqual({ state: "unavailable", available: false });
    expect(await (await page.request.post("/api/v1/image-generations", { data: { purpose: "explore" } })).json()).toEqual({ state: "no_context", available: false });
    expect((await page.request.post("/api/v1/image-generations", { data: { materialIds: ["nope"], purpose: "explore" } })).status()).toBe(422);
    expect((await page.request.get(`/api/v1/image-generations/${id}`)).status()).toBe(404);
  });
});
