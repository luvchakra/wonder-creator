import { expect, test, uid } from "./fixtures";

// Creation pages, step 4 (docs/ui-redesign/creation-pages.md): a Presentation opens on its own page — the current slide
// large and the strip; Edit slide, Add slide, Present; a theme from the named palettes; speaker notes; print to PDF.
test.describe("Presentation page", () => {
  test("an outline opens as slides; edit, add, theme and present them; every change is a version", async ({ page, creator }) => {
    void creator;
    const outline = ["# Platform 3", "A talk about waiting", "", "## Why trains", "- They wait for no one", "- Nor do we", "", "## The father", "Coat folded."].join("\n");
    const res = await page.request.post("/api/v1/artifacts", { data: { artifactType: "presentation", title: `Platform 3 ${uid()}`, content: outline } });
    const id = ((await res.json()) as { artifact: { id: string } }).artifact.id;

    // Older links to the Studio land on the page built for it.
    await page.goto(`/creations/${id}/studio`);
    await expect(page).toHaveURL(new RegExp(`/creations/${id}/deck$`));
    const slides = page.getByRole("list", { name: "Slides" });
    await expect(slides.getByRole("button")).toHaveCount(3);
    await expect(slides.getByRole("button", { name: "Slide 2: Why trains" })).toBeVisible();
    const editor = page.getByRole("region", { name: "Editor" });
    await expect(editor.getByText("Slide 1 of 3 · Editorial Paper")).toBeVisible();

    // Edit slide (the primary action): the title, words and notes autosave as a version.
    await slides.getByRole("button", { name: "Slide 2: Why trains" }).click();
    await page.getByRole("button", { name: "Edit slide" }).click();
    await editor.getByLabel("Slide title").fill("Why we wait");
    await editor.getByLabel("Speaker notes").fill("Pause here.");
    await expect(editor.getByText("Saved")).toBeVisible();
    await expect(slides.getByRole("button", { name: "Slide 2: Why we wait" })).toBeVisible();

    // Add slide, then move it earlier.
    await page.getByRole("button", { name: "Add slide" }).click();
    await expect(editor.getByText("Slide 3 of 4")).toBeVisible();
    await editor.getByLabel("Slide title").fill("Questions");
    await editor.getByRole("button", { name: "Move later" }).click();
    await expect(slides.getByRole("button", { name: "Slide 4: Questions" })).toHaveAttribute("aria-current", "true");
    await expect(editor.getByText("Saved")).toBeVisible();

    // Theme, from More.
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("dialog", { name: "Save, version and publish" }).getByRole("button", { name: /^Theme/ }).click();
    await page.getByRole("dialog", { name: "Theme" }).getByRole("button", { name: /Cinematic Dark/ }).click();
    await expect(editor.getByText(/Cinematic Dark/)).toBeVisible();
    await expect(editor.getByText("Saved")).toBeVisible();

    // The versions hold the deck; the words read as headings, never the notes.
    const versions = (await (await page.request.get(`/api/v1/artifacts/${id}/versions`)).json()) as { versions: Array<{ content: string; structured_content?: { kind?: string; theme?: string } }> };
    expect(versions.versions[0]!.content).toContain("## Why we wait");
    expect(versions.versions[0]!.content).toContain("## Questions");
    expect(versions.versions[0]!.content).not.toContain("Pause here.");

    // Present: full screen, arrows move on, N shows the notes, Escape ends it.
    await slides.getByRole("button", { name: "Slide 1: Platform 3" }).click();
    await page.getByRole("button", { name: "Present" }).click();
    const show = page.getByRole("dialog", { name: "Presenting" });
    await expect(show.getByText("1 / 4")).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(show.getByText("2 / 4")).toBeVisible();
    await page.keyboard.press("n");
    await expect(show.getByText("Pause here.")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(show).toBeHidden();
    await expect(slides.getByRole("button", { name: "Slide 2: Why we wait" })).toHaveAttribute("aria-current", "true");

    // Print or save as PDF: only the slides, one to a page.
    await page.evaluate(() => {
      (window as unknown as { printed: string | null }).printed = null;
      window.print = () => {
        (window as unknown as { printed: string | null }).printed = document.body.className;
      };
    });
    await page.getByRole("button", { name: "More" }).click();
    await page.getByRole("dialog", { name: "Save, version and publish" }).getByRole("button", { name: /^Print or save as PDF/ }).click();
    expect(await page.evaluate(() => (window as unknown as { printed: string | null }).printed)).toContain("printing-deck");
    await expect(page.locator(".deck-print > *")).toHaveCount(4);

    // A save made against an older version is refused.
    const stale = await page.request.post(`/api/v1/artifacts/${id}/deck`, { data: { deck: { kind: "deck", theme: "paper", slides: [] }, baseVersionId: "00000000-0000-0000-0000-000000000000" } });
    expect(stale.status()).toBe(409);
  });
});
