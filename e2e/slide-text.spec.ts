import { expect, seedSlideVisuals, test, uid } from "./fixtures";

test.describe("words on slide visuals", () => {
  test("each slide starts with its line from the Carousel; the set is composed in the browser and kept with provenance", async ({ page, creator }) => {
    const content = "### Slide 1\n**Text:** बारिश की पहली बूँद\n**Visual:** rain on glass\n\n### Slide 2\n**Text:** Chai, again\n\n### Slide 3\n**Text:** Home";
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "carousel", title: `Monsoon ${uid()}`, content } })).json()).artifact as { id: string };
    const genId = await seedSlideVisuals(creator.id, art.id, 3);
    // e2e has no image model: the seeded set stands in for this Creation's stored slide visuals.
    await page.route("**/api/v1/image-generations", async (route) => {
      const { generation } = await (await page.request.get(`/api/v1/image-generations/${genId}`)).json();
      await route.fulfill({ json: { state: "generation", generation, available: true } });
    });

    await page.goto(`/artifacts/${art.id}`);
    const section = page.getByRole("region", { name: "Slide visuals" });
    await section.getByRole("button", { name: /Quiet/ }).click();
    await section.getByRole("button", { name: "Add text" }).click();

    const dialog = page.getByRole("dialog", { name: "Add text" });
    await expect(dialog.getByText("Slide 1 of 3")).toBeVisible();
    await expect(dialog.getByLabel("Words on this slide")).toHaveValue("बारिश की पहली बूँद");
    await expect(dialog.getByRole("img", { name: "Preview with the words: बारिश की पहली बूँद" })).toBeVisible();

    await dialog.getByRole("button", { name: "Next slide" }).click();
    await expect(dialog.getByText("Slide 2 of 3")).toBeVisible();
    await expect(dialog.getByLabel("Words on this slide")).toHaveValue("Chai, again");
    await dialog.getByRole("radio", { name: "Cream band" }).click();
    await expect(dialog.getByRole("radio", { name: "Cream band" })).toHaveAttribute("aria-checked", "true");
    await dialog.getByRole("button", { name: "Add to this Creation" }).click();
    await expect(dialog.getByRole("status")).toContainText("Added to this Creation's references.");
    await expect(dialog.getByRole("button", { name: "Add to this Creation" })).toBeDisabled();
    const href = await dialog.getByRole("link", { name: "Open Material" }).getAttribute("href");

    // Change the words and it can be kept again.
    await dialog.getByLabel("Words on this slide").fill("Chai, always");
    await expect(dialog.getByRole("button", { name: "Add to this Creation" })).toBeEnabled();

    await page.goto(href!);
    await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue("Slide 2 · Chai, again");

    // Only real images are kept.
    const bad = await page.request.post(`/api/v1/image-generations/${genId}/text`, {
      multipart: { file: { name: "x.png", mimeType: "image/png", buffer: Buffer.from("<svg onload=alert(1)>") }, assetId: "00000000-0000-4000-8000-000000000000", text: "hi" },
    });
    expect(bad.status()).toBeGreaterThanOrEqual(400);
  });
});
