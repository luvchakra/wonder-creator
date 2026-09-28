import { expect, seedCarousel, seedSlideVisuals, test, uid } from "./fixtures";

const poem = "चाँद घटते-घटते\nअमावस की जेब में जा छुपा है,\n\nऔर आईने के सामने देखो तो—\nबस एक तन्हाई है\n\nधुँधली रोशनी में\nचेहरा भी जैसे कोई सवाल है,";
const carousel = async (page: import("./fixtures").Page, content = poem) =>
  ((await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "carousel", title: `Amavas ${uid()}`, content } })).json()).artifact as { id: string }).id;

test.describe("Carousel Composer", () => {
  test("setup asks how many images first, with one CTA; it's honest when generation isn't connected", async ({ page, creator }) => {
    void creator;
    const id = await carousel(page);
    await page.goto(`/artifacts/${id}`);
    const count = page.getByRole("radiogroup", { name: "How many images?" });
    await expect(count.getByRole("radio", { name: "5" })).toHaveAttribute("aria-checked", "true");
    await count.getByRole("radio", { name: "3" }).click();
    await page.getByRole("radiogroup", { name: "Visual style" }).getByRole("radio", { name: "Atmospheric" }).click();
    // No permanent tab row or action wall on the working screen (§30).
    await expect(page.getByRole("tab")).toHaveCount(0);
    await page.getByRole("button", { name: "Generate 3 images" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText("Image generation isn't connected.");
    // Details keeps About/Materials/Versions/Rights/People.
    await page.getByRole("link", { name: "Details" }).click();
    await expect(page).toHaveURL(new RegExp(`/artifacts/${id}\\?details=1$`));
    await expect(page.getByRole("tab", { name: "Rights" })).toBeVisible();
  });

  test("existing images become slides for free, each with its matched words", async ({ page, creator }) => {
    const id = await carousel(page);
    await seedSlideVisuals(creator.id, id, 3, 64);
    await page.goto(`/artifacts/${id}`);
    await expect(page.getByText("You already have 3 images for this Carousel.")).toBeVisible();
    await page.getByRole("button", { name: "Use these" }).click();
    const slides = page.getByRole("list", { name: "Slides" });
    await expect(slides.getByRole("listitem")).toHaveCount(3);
    await expect(slides.getByRole("link", { name: /^Slide 2 of 3: और आईने के सामने देखो तो—/ })).toBeVisible();
  });

  test("overview: arrange with the arrows (kept after reload); one more is honest without generation", async ({ page, creator }) => {
    const id = await carousel(page);
    await seedCarousel(creator.id, id, ["First light", "Second wind", "Third act"]);
    await page.goto(`/artifacts/${id}`);
    const slides = page.getByRole("list", { name: "Slides" });
    await expect(slides.getByRole("listitem")).toHaveCount(3);
    // One prominent action; two quiet ones.
    await expect(page.getByRole("link", { name: "Continue Creating" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate one more" })).toBeVisible();

    await page.getByRole("button", { name: "Arrange" }).click();
    const order = page.getByRole("list", { name: "Slide order" });
    await expect(page.getByRole("button", { name: "Generate one more" })).toHaveCount(0); // nothing else while arranging
    await order.getByRole("button", { name: "Move slide 1 down" }).click();
    await expect(order.getByRole("listitem").first()).toContainText("Second wind");
    await page.getByRole("button", { name: "Done" }).click();
    await expect(slides.getByRole("listitem").first()).toContainText("Second wind");
    await page.reload();
    await expect(slides.getByRole("listitem").first()).toContainText("Second wind");

    await page.getByRole("button", { name: "Generate one more" }).click();
    const sheet = page.getByRole("dialog", { name: "Add one more slide" });
    await sheet.getByRole("button", { name: "Night scene" }).click();
    await expect(sheet.getByLabel("Instruction (optional)")).toHaveValue("Night scene");
    await sheet.getByRole("button", { name: "Generate one more" }).click();
    await expect(sheet.getByRole("alert")).toHaveText("Image generation isn't connected.");
  });

  test("Studio canvas: one slide fills the canvas with its words, the strip moves between slides, and a tap opens the editor", async ({ page, creator }) => {
    const id = await carousel(page);
    const [first] = await seedCarousel(creator.id, id, ["First light", "Second wind", "Third act"]);
    await page.goto(`/artifacts/${id}/studio`);
    const editor = page.getByRole("region", { name: "Editor" });
    await expect(editor.getByRole("link", { name: /^Edit slide 1 of 3: First light/ })).toBeVisible();
    await expect(editor.getByText("1 / 3")).toBeVisible();
    // Nothing else competes on the canvas: no slide list, no Continue Creating, one "+" to make one more.
    await expect(page.getByRole("link", { name: "Continue Creating" })).toHaveCount(0);
    await expect(editor.getByRole("button", { name: "Generate one more" })).toBeVisible();
    await editor.getByRole("button", { name: "Next slide" }).click();
    await expect(editor.getByRole("link", { name: /^Edit slide 2 of 3: Second wind/ })).toBeVisible();
    await editor.getByRole("list", { name: "Slides" }).getByRole("button", { name: "Slide 3 of 3" }).click();
    await expect(editor.getByText("3 / 3")).toBeVisible();
    // Arrange lives under More; the order is kept.
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Save, version and publish" })
      .getByRole("button", { name: /Arrange slides/ })
      .click();
    const order = page.getByRole("list", { name: "Slide order" });
    await order.getByRole("button", { name: "Move slide 1 down" }).click();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(editor.getByRole("link", { name: /^Edit slide 1 of 3: Second wind/ })).toBeVisible();
    // Tapping the slide opens the focused editor (slide 2 is now the original first).
    await editor.getByRole("list", { name: "Slides" }).getByRole("button", { name: "Slide 2 of 3" }).click();
    await editor.getByRole("link", { name: /^Edit slide 2 of 3: First light/ }).click();
    await expect(page).toHaveURL(new RegExp(`/slides/${first}$`));
  });

  test("slide editor: edit words, place and style them on the image, split, and it all autosaves", async ({ page, creator }) => {
    const id = await carousel(page);
    const [, second] = await seedCarousel(creator.id, id, ["First light", "In the mirror—\nonly loneliness.", "Third act"]);
    await page.goto(`/artifacts/${id}`);
    await page.getByRole("link", { name: "Continue Creating" }).click();
    await expect(page.getByText("1 of 3", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next slide" }).click();
    await expect(page).toHaveURL(new RegExp(`/slides/${second}$`));
    await expect(page.getByText("2 of 3", { exact: true })).toBeVisible();

    // Text: edit the words and place them on the image (read mode keeps them as real text).
    await page.getByRole("toolbar", { name: "Edit slide" }).getByRole("button", { name: "Text" }).click();
    await page.getByLabel("Words for this slide").fill("In the mirror —\nonly loneliness.");
    await page.getByRole("switch", { name: "Place on image" }).click();
    const words = page.getByRole("application", { name: /Words on the image/ });
    await expect(words).toHaveText("In the mirror —\nonly loneliness.");
    // Drag the words up, and nudge them with the keyboard.
    const box = (await words.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y - 120, { steps: 6 });
    await page.mouse.up();
    await words.focus();
    await page.keyboard.press("ArrowLeft");

    // Style: a font and a preset position.
    await page.getByRole("toolbar", { name: "Edit slide" }).getByRole("button", { name: "Style" }).click();
    await page
      .getByRole("radiogroup", { name: "Font" })
      .getByRole("radio", { name: /Modern/ })
      .click();
    await page.getByRole("group", { name: "Position" }).getByRole("button", { name: "Top centre" }).click();
    await expect(page.getByRole("banner").getByText("Saved")).toBeVisible();

    // Kept after a reload.
    await page.reload();
    await page.getByRole("toolbar", { name: "Edit slide" }).getByRole("button", { name: "Style" }).click();
    await expect(page.getByRole("radiogroup", { name: "Font" }).getByRole("radio", { name: /Modern/ })).toHaveAttribute("aria-checked", "true");
    await expect(page.getByRole("group", { name: "Position" }).getByRole("button", { name: "Top centre" })).toHaveAttribute("aria-pressed", "true");

    // Full screen and back.
    await page.getByRole("button", { name: "More for this slide" }).click();
    await page.getByRole("menuitem", { name: "View full screen" }).click();
    await expect(page.getByRole("dialog", { name: "Slide 2, full screen" })).toBeVisible();
    await page.getByRole("button", { name: "Close full screen" }).click();

    // Regenerate is honest without generation.
    await page.getByRole("toolbar", { name: "Edit slide" }).getByRole("button", { name: "Regenerate" }).click();
    const regen = page.getByRole("dialog", { name: "Regenerate this image" });
    await regen.getByLabel("Instruction (optional)").fill("Warmer, closer shot");
    await regen.getByRole("button", { name: "Regenerate" }).click();
    await expect(regen.getByRole("alert")).toHaveText("Image generation isn't connected.");
    await regen.getByRole("button", { name: "Cancel" }).click();

    // Split into two slides: no new image, the rest follows.
    await page.getByRole("toolbar", { name: "Edit slide" }).getByRole("button", { name: "Text" }).click();
    await page.getByRole("button", { name: "Split into two slides" }).click();
    await expect(page.getByText("2 of 4", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Words for this slide")).toHaveValue("In the mirror —");
    await page.getByRole("link", { name: "Done" }).click();
    const slides = page.getByRole("list", { name: "Slides" });
    await expect(slides.getByRole("listitem")).toHaveCount(4);
    await expect(slides.getByRole("listitem").nth(2)).toContainText("only loneliness.");
  });
});
