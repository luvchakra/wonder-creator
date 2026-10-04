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

    // One primary action (Done while writing), two secondaries; the kind can still change while it's empty.
    const kinds = page.getByRole("group", { name: "Kind of writing" });
    await expect(kinds.getByRole("button")).toHaveText(["Passage", "Poem", "Screenplay"]);
    await kinds.getByRole("button", { name: "Poem" }).click();
    await expect(kinds.getByRole("button", { name: "Poem" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: "Cover" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Read", exact: true })).toBeVisible();

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
    await page.keyboard.press("Escape");
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
