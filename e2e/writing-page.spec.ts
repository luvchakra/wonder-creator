import { expect, test, uid } from "./fixtures";

// Creation pages, step 1 (docs/ui-redesign/creation-pages.md): Writing opens a page built for writing.
test.describe("Writing page", () => {
  test("Make a new Creation › Writing opens the Writing page: choose a poem, write, set it on paper", async ({ page, creator }) => {
    void creator;
    await page.goto("/");
    await page.getByRole("button", { name: "Open Creative Palette" }).click();
    await page.getByRole("dialog", { name: "Creative Palette" }).getByRole("button", { name: "Create" }).click();
    await page.getByRole("dialog", { name: "Make a new Creation" }).getByRole("button", { name: /Writing/ }).click();
    await expect(page).toHaveURL(/\/creations\/[0-9a-f-]{36}\/write$/);

    // One primary action (Done while writing), two secondaries; the kind changes any time, the page set to suit it.
    await page.getByRole("button", { name: "Kind of writing: Story" }).click();
    const kinds = page.getByRole("dialog", { name: "Kind of writing" });
    await expect(kinds.getByRole("button")).toContainText(["Poem", "Prose", "Essay", "Article", "News", "Story"]);
    await kinds.getByRole("button", { name: /^Poem/ }).click();
    await expect(page.getByRole("button", { name: "Kind of writing: Poem" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Cover" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Preview", exact: true })).toBeVisible();

    const words = `The lantern keeps its small promise ${uid()}\nall night, on the jetty.`;
    await page.getByLabel("Poem text").fill(words);
    await expect(page.getByPlaceholder("The first line…")).toHaveCount(1);
    await page.getByRole("button", { name: "Done" }).click();
    // No cover: the words on paper, verse centred.
    const editor = page.getByRole("region", { name: "Editor" });
    await expect(editor.getByText("all night, on the jetty.", { exact: false })).toBeVisible();
    await expect(page.getByRole("button", { name: "Write" })).toBeVisible();

    // Cover: with no picture only Paper is offered, and CreativeMind can make one.
    await page.getByRole("button", { name: "Cover" }).click();
    const cover = page.getByRole("dialog", { name: "Cover" });
    await expect(cover.getByRole("radiogroup", { name: "How the words are set" }).getByRole("radio")).toHaveText(["Paper"]);
    await expect(cover.getByRole("button", { name: /Let CreativeMind make one/ })).toBeVisible();
    // The ornament that heads and closes the piece, after Roman architecture — kept with the Creation.
    const ornaments = cover.getByRole("radiogroup", { name: "Ornament" });
    await expect(ornaments.getByRole("radio", { name: "Keystone" })).toHaveAttribute("aria-checked", "true");
    await ornaments.getByRole("radio", { name: "Laurel" }).click();
    await page.keyboard.press("Escape");
    await page.reload();
    await page.getByRole("button", { name: "Cover" }).click();
    await expect(page.getByRole("dialog", { name: "Cover" }).getByRole("radio", { name: "Laurel" })).toHaveAttribute("aria-checked", "true");
    await page.keyboard.press("Escape");
  });

  test("each kind is set after the publications that set it best: an essay's drop cap, news with its byline and date", async ({ page, creator }) => {
    void creator;
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "news", title: "Harbour reopens", content: "The harbour reopened on Saturday.\n\nCrews returned before dawn." } })).json()).artifact as { id: string };
    await page.goto(`/creations/${art.id}/write`);
    const editor = page.getByRole("region", { name: "Editor" });
    await expect(editor.getByRole("heading", { name: "Harbour reopens" })).toBeVisible();
    await expect(editor.getByText(/^By /)).toBeVisible();
    // The date sits in the byline row, never as a made-up dateline before the first line.
    await expect(editor.getByText(/\d{1,2} [A-Z]{3} —/)).toHaveCount(0);
    // The same words as an essay, read on their own page.
    await page.getByRole("button", { name: "Kind of writing: News" }).click();
    await page.getByRole("dialog", { name: "Kind of writing" }).getByRole("button", { name: /^Essay/ }).click();
    await expect(page.getByRole("button", { name: "Kind of writing: Essay" })).toBeVisible();
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("dialog", { name: "Save, version and publish" }).getByRole("button", { name: /Read it on its own/ }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Harbour reopens" })).toBeVisible();
    await expect(page.getByText("Crews returned before dawn.")).toBeVisible();
  });

  test("Publish as link: the latest saved version on its own page, link-only unless shown on the Creator Page", async ({ page, creator, browser }) => {
    const tag = uid();
    const title = `Harbour Lights ${tag}`;
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "story", title, content: "The harbour lights came on one by one.\n\nNobody counted them." } })).json()).artifact as { id: string };
    // The Studio address forwards writing to its page.
    await page.goto(`/creations/${art.id}/studio`);
    await expect(page).toHaveURL(new RegExp(`/creations/${art.id}/write$`));

    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("dialog", { name: "Save, version and publish" }).getByRole("button", { name: /Publish as link/ }).click();
    const sheet = page.getByRole("dialog", { name: "Publish as link" });
    await expect(sheet.getByRole("switch", { name: "Show on my Creator Page" })).not.toBeChecked();
    await sheet.getByRole("button", { name: "Publish as link" }).click();
    await expect(sheet.getByText(/^Published/)).toBeVisible();
    const path = `/p/${creator.handle}/harbour-lights-${tag.toLowerCase()}`;
    await expect(sheet.getByText(new RegExp(`${path}$`))).toBeVisible();

    // Anyone with the link can read it — the words, the creator's name, no counts.
    const guest = await (await browser.newContext()).newPage();
    await guest.goto(path);
    await expect(guest.getByRole("heading", { level: 1, name: title })).toBeVisible();
    await expect(guest.getByText("Nobody counted them.")).toBeVisible();
    await expect(guest.getByText(/\b\d+ (views|likes)\b/)).toHaveCount(0);
    await guest.context().close();

    // Take it down: the address stops working for everyone else.
    await sheet.getByRole("button", { name: "Take it down" }).click();
    await expect(sheet.getByRole("button", { name: "Publish as link" })).toBeVisible();
  });
});

test.describe("Preview", () => {
  test("Preview shows the page readers would see, publishes from there, and the Writing page then shows the link", async ({ page, creator }) => {
    const tag = uid();
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title: `Lantern ${tag}`, content: "The lantern keeps its small promise\nall night, on the jetty." } })).json()).artifact as { id: string };
    await page.goto(`/creations/${art.id}/write`);
    await page.getByRole("link", { name: "Preview", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/creations/${art.id}/preview$`));
    // The public renderer, as readers would see it: title, byline, the words — and one next step.
    await expect(page.getByRole("heading", { level: 1, name: `Lantern ${tag}` })).toBeVisible();
    await expect(page.getByText("A poem by")).toBeVisible();
    await expect(page.getByText("all night, on the jetty.")).toBeVisible();
    await page.getByRole("button", { name: "Publish as link" }).click();
    await expect(page.getByText(/^Published/)).toBeVisible();
    await expect(page.getByRole("button", { name: /Copy link/ })).toBeVisible();
    // Back on the Writing page, the link is right there.
    await page.getByRole("link", { name: "Back to writing" }).click();
    await expect(page).toHaveURL(new RegExp(`/creations/${art.id}/write$`));
    await expect(page.getByRole("status").filter({ hasText: "Published" })).toContainText(`/p/${creator.handle}/lantern-${tag.toLowerCase()}`);
  });
});
