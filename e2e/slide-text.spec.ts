import { expect, seedSlideVisuals, test, uid, type Page } from "./fixtures";

/** e2e has no image model: the seeded set stands in for this Creation's stored slide visuals (read fresh each time). */
async function stubLookup(page: Page, genId: string) {
  await page.route("**/api/v1/image-generations", async (route) => {
    const { generation } = await (await page.request.get(`/api/v1/image-generations/${genId}`)).json();
    await route.fulfill({ json: { state: "generation", generation, available: true } });
  });
}

test.describe("words on slide visuals", () => {
  // Stop the lookup stub before the page closes, so a late lookup can't outlive the test.
  test.afterEach(({ page }) => page.unrouteAll({ behavior: "ignoreErrors" }));

  test("each slide starts with its line from the Carousel; the set is composed in the browser and kept with provenance", async ({ page, creator }) => {
    const content = "### Slide 1\n**Text:** बारिश की पहली बूँद\n**Visual:** rain on glass\n\n### Slide 2\n**Text:** Chai, again\n\n### Slide 3\n**Text:** Home";
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "carousel", title: `Monsoon ${uid()}`, content } })).json()).artifact as { id: string };
    const genId = await seedSlideVisuals(creator.id, art.id, 3);
    await stubLookup(page, genId);

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

  test("reorder the set from More; each slide's words follow its new place; changing an image is honest when generation isn't connected", async ({ page, creator }) => {
    const content = "Slide 1: First light\nSlide 2: Second wind\nSlide 3: Third act";
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "carousel", title: `Order ${uid()}`, content } })).json()).artifact as { id: string };
    const genId = await seedSlideVisuals(creator.id, art.id, 3);
    await stubLookup(page, genId);
    await page.goto(`/artifacts/${art.id}`);
    const section = page.getByRole("region", { name: "Slide visuals" });
    const list = section.getByRole("list", { name: "Visual directions" });
    await expect(list.getByRole("listitem")).toHaveCount(3);
    await section.getByRole("button", { name: /Quiet/ }).click();

    await section.getByRole("button", { name: "More for this image" }).click();
    await expect(page.getByRole("menuitem", { name: "Move earlier" })).toHaveCount(0);
    await page.getByRole("menuitem", { name: "Move later" }).click();
    await expect(list.getByRole("listitem").nth(1)).toContainText("Quiet");
    await expect(list.getByRole("listitem").first()).toContainText("Bold");

    // Kept on the server: a reload shows the same order.
    await page.reload();
    await expect(list.getByRole("listitem").nth(1)).toContainText("Quiet");

    // Quiet is now slide 2: its words are slide 2's.
    await section.getByRole("button", { name: /Quiet/ }).click();
    await section.getByRole("button", { name: "Add text" }).click();
    const dialog = page.getByRole("dialog", { name: "Add text" });
    await expect(dialog.getByText("Slide 2 of 3")).toBeVisible();
    await expect(dialog.getByLabel("Words on this slide")).toHaveValue("Second wind");
    await page.keyboard.press("Escape");

    await section.getByRole("button", { name: "More for this image" }).click();
    await page.getByRole("menuitem", { name: "Change this image…" }).click();
    const change = page.getByRole("dialog", { name: "Change this image" });
    await change.getByLabel("What should change?").fill("make it night, with rain on the window");
    await change.getByRole("button", { name: "Change image" }).click();
    await expect(change.getByRole("alert")).toHaveText("Image generation isn't connected.");
  });
});
