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
    // The Creation page opens the Studio; look inside its canvas (the redirect briefly holds both pages).
    const composer = page.getByRole("region", { name: "Editor" });
    await expect(composer.getByText("You already have 3 images for this Carousel.")).toBeVisible();
    await composer.getByRole("button", { name: "Use these" }).click();
    // The owner is on the Studio canvas: the slides appear there, each with its matched words.
    await expect(page).toHaveURL(new RegExp(`/artifacts/${id}/studio$`));
    const editor = page.getByRole("region", { name: "Editor" });
    await expect(editor.getByRole("list", { name: "Slides" }).getByRole("button", { name: "Slide 3 of 3" })).toBeVisible();
    await editor.getByRole("list", { name: "Slides" }).getByRole("button", { name: "Slide 2 of 3" }).click();
    await expect(editor.getByRole("link", { name: /^Edit slide 2 of 3: और आईने के सामने देखो तो—/ })).toBeVisible();
  });

  test("the owner's Creation page opens the Studio canvas; one more is honest without generation; Details keeps the overview facts", async ({ page, creator }) => {
    const id = await carousel(page);
    await seedCarousel(creator.id, id, ["First light", "Second wind", "Third act"]);
    await page.goto(`/artifacts/${id}`);
    await expect(page).toHaveURL(new RegExp(`/artifacts/${id}/studio$`));
    const editor = page.getByRole("region", { name: "Editor" });
    await editor.getByRole("button", { name: "Add slide" }).click();
    const sheet = page.getByRole("dialog", { name: "Add one more slide" });
    await sheet.getByRole("button", { name: "Night scene" }).click();
    await expect(sheet.getByLabel("Instruction (optional)")).toHaveValue("Night scene");
    await sheet.getByRole("button", { name: "Generate one more" }).click();
    await expect(sheet.getByRole("alert")).toHaveText("Image generation isn't connected.");
    await page.goto(`/artifacts/${id}?details=1`);
    await expect(page.getByRole("tab", { name: "Rights" })).toBeVisible();
  });

  test("Studio canvas: one slide fills the canvas with its words, the strip moves between slides, and a tap opens the editor", async ({ page, creator }) => {
    const id = await carousel(page);
    const [, second] = await seedCarousel(creator.id, id, ["First light", "Second wind", "Third act"]);
    await page.goto(`/artifacts/${id}/studio`);
    const editor = page.getByRole("region", { name: "Editor" });
    await expect(editor.getByRole("link", { name: /^Edit slide 1 of 3: First light/ })).toBeVisible();
    await expect(editor.getByText("1 / 3")).toBeVisible();
    // Nothing else competes on the canvas: no slide list, no Continue Creating, no Reorder pill; one dashed "Add slide".
    await expect(page.getByRole("link", { name: "Continue Creating" })).toHaveCount(0);
    await expect(editor.getByRole("button", { name: "Reorder" })).toHaveCount(0);
    await expect(editor.getByRole("button", { name: "Add slide" })).toBeVisible();
    // "Refine text" on the slide: one suggestion at a time, the creator's choice; offline it's labelled as a placeholder.
    await editor.getByRole("button", { name: /Refine text/ }).click();
    await page.getByRole("menuitem", { name: "Shorten" }).click();
    const newWords = editor.getByRole("region", { name: "New words for this slide" });
    await expect(newWords).toContainText("offline placeholder");
    await expect(newWords.getByRole("button", { name: "Use new" })).toBeVisible();
    await newWords.getByRole("button", { name: "Keep current" }).click();
    await expect(newWords).toHaveCount(0);
    await editor.getByRole("button", { name: "Next slide" }).click();
    await expect(editor.getByRole("link", { name: /^Edit slide 2 of 3: Second wind/ })).toBeVisible();
    await editor.getByRole("list", { name: "Slides" }).getByRole("button", { name: "Slide 3 of 3" }).click();
    await expect(editor.getByText("3 / 3")).toBeVisible();
    // The navbar names the slide on screen and what's shaping it (Phase 04 §17).
    await expect(page.getByRole("banner").getByRole("status")).toHaveAttribute("aria-label", /Slide 3 · 0 sources/);
    // Arrange lives under More; the order is kept.
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page
      .getByRole("dialog", { name: "Save, version and publish" })
      .getByRole("button", { name: /Arrange slides/ })
      .click();
    const order = page.getByRole("list", { name: "Slide order" });
    // The navbar says what's happening (Phase 04 §12).
    await expect(page.getByRole("banner").getByRole("status")).toHaveAttribute("aria-label", /Arrange 3 slides/);
    await order.getByRole("button", { name: "Move slide 1 down" }).click();
    await page.getByRole("button", { name: "Done" }).click();
    await expect(editor.getByRole("link", { name: /^Edit slide 1 of 3: Second wind/ })).toBeVisible();
    // Shift + arrow moves a slide without a drag: the first (Second wind) goes right, so First light leads again.
    await editor.getByRole("list", { name: "Slides" }).getByRole("button", { name: "Slide 1 of 3" }).focus();
    await page.keyboard.press("Shift+ArrowRight");
    await expect(editor.getByRole("link", { name: /^Edit slide 2 of 3: Second wind/ })).toBeVisible();
    await page.reload();
    await editor.getByRole("list", { name: "Slides" }).getByRole("button", { name: "Slide 1 of 3" }).click();
    await expect(editor.getByRole("link", { name: /^Edit slide 1 of 3: First light/ })).toBeVisible();
    // Tapping the slide opens the focused editor (slide 2 is Second wind again).
    await editor.getByRole("list", { name: "Slides" }).getByRole("button", { name: "Slide 2 of 3" }).click();
    await editor.getByRole("link", { name: /^Edit slide 2 of 3: Second wind/ }).click();
    await expect(page).toHaveURL(new RegExp(`/slides/${second}$`));
  });

  test("Studio canvas on a short phone @mobile: the slide shrinks so the strip stays visible above the bottom bar", async ({ page, creator }) => {
    const id = await carousel(page);
    await seedCarousel(creator.id, id, ["First light", "Second wind", "Third act"]);
    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/artifacts/${id}/studio`);
    const editor = page.getByRole("region", { name: "Editor" });
    await expect(editor.getByRole("link", { name: /^Edit slide 1 of 3/ })).toBeVisible();
    const thumb = editor.getByRole("list", { name: "Slides" }).getByRole("button", { name: "Slide 1 of 3" });
    await expect(thumb).toBeInViewport({ ratio: 1 });
    // Nothing fixed (the Sources pill, the "+") sits over it.
    const b = (await thumb.boundingBox())!;
    const hit = await page.evaluate(([x, y]) => !!document.elementFromPoint(x!, y!)?.closest("[data-slide-thumb]"), [b.x + b.width / 2, b.y + b.height / 2]);
    expect(hit).toBe(true);
    // The slide kept its shape: narrower, not cropped.
    const frame = (await editor.getByRole("link", { name: /^Edit slide 1 of 3/ }).boundingBox())!;
    expect(frame.width).toBeLessThan(330);
    expect(Math.abs(frame.height / frame.width - 1.25)).toBeLessThan(0.05);
  });

  test("on a phone @mobile: words sit on the image from the start, the slide strip scrolls both ways, and Back leaves the Carousel", async ({ page, creator }) => {
    const id = await carousel(page);
    await seedCarousel(creator.id, id, ["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight"]);
    await page.setViewportSize({ width: 360, height: 740 });
    await page.goto("/space?tab=creations");
    await page.goto(`/artifacts/${id}/studio`);
    const editor = page.getByRole("region", { name: "Editor" });
    // Text on the image by default (owner, 29 Sep 2026) — draggable right there, not a caption under the frame.
    await expect(editor.getByRole("button", { name: /^Words on the image/ })).toContainText("One");

    // The strip is wider than the phone: › and ‹ move it; the current thumbnail follows the slide on screen.
    const strip = editor.getByRole("list", { name: "Slides" });
    const scrolled = () => strip.evaluate((el) => el.scrollLeft);
    await expect(editor.getByRole("button", { name: "Scroll slides left" })).toHaveCount(0);
    await editor.getByRole("button", { name: "Scroll slides right" }).click();
    await expect.poll(scrolled).toBeGreaterThan(0);
    await editor.getByRole("button", { name: "Scroll slides left" }).click();
    await expect.poll(scrolled).toBe(0);
    // A finger swipe scrolls it too (thumbnails no longer lock horizontal panning for a reorder).
    expect(await strip.getByRole("button", { name: "Slide 2 of 8" }).evaluate((el) => getComputedStyle(el).touchAction)).toBe("auto");
    await editor.getByRole("button", { name: "Previous slide" }).click();
    await expect(strip.getByRole("button", { name: "Slide 8 of 8" })).toBeInViewport();

    // Back goes where the creator came from, never round into the Studio again.
    await page.getByRole("link", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/space\?tab=creations$/);
    await page.goto("/");
    await page.goto(`/artifacts/${id}`); // a Carousel's Creation page opens its Studio
    await expect(page).toHaveURL(new RegExp(`/artifacts/${id}/studio$`));
    await page.getByRole("link", { name: "Back" }).click();
    await expect(page).toHaveURL(/\/$/);
  });

  test("slide editor: edit words, place and style them on the image, split, and it all autosaves", async ({ page, creator }) => {
    const id = await carousel(page);
    const [, second] = await seedCarousel(creator.id, id, ["First light", "In the mirror—\nonly loneliness.", "Third act"]);
    await page.goto(`/artifacts/${id}/studio`);
    await page
      .getByRole("region", { name: "Editor" })
      .getByRole("link", { name: /^Edit slide 1 of 3/ })
      .click();
    await expect(page.getByText("1 of 3", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Next slide" }).click();
    await expect(page).toHaveURL(new RegExp(`/slides/${second}$`));
    await expect(page.getByText("2 of 3", { exact: true })).toBeVisible();

    // Text: edit the words and place them on the image (read mode keeps them as real text).
    await page.getByRole("toolbar", { name: "Edit slide" }).getByRole("button", { name: "Text" }).click();
    await page.getByLabel("Words for this slide").fill("In the mirror —\nonly loneliness.");
    // Words are on the image from the start (owner, 29 Sep 2026).
    await expect(page.getByRole("switch", { name: "Place on image" })).toHaveAttribute("aria-checked", "true");
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
    // Done goes back to the Studio canvas, not the old overview.
    await page.getByRole("link", { name: "Done" }).click();
    await expect(page).toHaveURL(new RegExp(`/artifacts/${id}/studio$`));
    const editor = page.getByRole("region", { name: "Editor" });
    await editor.getByRole("list", { name: "Slides" }).getByRole("button", { name: "Slide 3 of 4" }).click();
    await expect(editor.getByRole("link", { name: /^Edit slide 3 of 4: only loneliness\./ })).toBeVisible();
  });
});
