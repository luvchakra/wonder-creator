import { artifactCard, expect, pngBytes, poemFromNote, saveNote, test, uid } from "./fixtures";

test.describe("creating with CreativeMind", () => {
  test.beforeEach(({ creator }) => void creator);

  test("universal composer on Home: text + attachment lands in meTalk with a draft", async ({ page }) => {
    // meTalk is a transient sheet from the Palette, not a chat screen.
    await page.goto("/");
    await page.getByRole("button", { name: "Open Creative Palette" }).click();
    await page.getByRole("dialog", { name: "Creative Palette" }).getByRole("button", { name: "Create" }).click();
    await page
      .getByRole("dialog", { name: "Make a new Creation" })
      .getByRole("button", { name: /Let CreativeMind decide/ })
      .click();
    const sheet = page.getByRole("dialog", { name: "meTalk" });
    const composer = sheet.getByLabel("What are you thinking about?");
    await expect(sheet.getByRole("button", { name: "Send", exact: true })).toBeDisabled();
    await composer.fill("Write a poem about the lighthouse at dawn.");

    const file = `lighthouse-${uid()}`;
    const chooser = page.waitForEvent("filechooser");
    await page.getByRole("button", { name: "Add files" }).click();
    await (await chooser).setFiles({ name: `${file}.png`, mimeType: "image/png", buffer: pngBytes() });
    const attachments = page.getByRole("list", { name: "Attachments" });
    await expect(attachments).toContainText(`${file}.png`);
    await expect(attachments.getByRole("button", { name: `Remove ${file}.png` })).toBeVisible();

    await page.getByRole("button", { name: "Send", exact: true }).click();
    await expect(page).toHaveURL(/\/create\?c=[0-9a-f-]{36}$/, { timeout: 45_000 });

    const talk = page.getByRole("region", { name: "meTalk" });
    await expect(talk.getByText("Write a poem about the lighthouse at dawn.").first()).toBeVisible();
    // The photo was stored as material and is attached to the creator's message.
    await expect(talk.getByRole("list", { name: "Attached material" }).getByRole("link", { name: file })).toBeVisible();
    const card = artifactCard(page);
    await expect(card).toBeVisible();
    await expect(card).toContainText("Poem");
    await expect(card.getByRole("link", { name: /View/ })).toHaveAttribute("href", /\/artifacts\/[0-9a-f-]{36}$/);
    await expect(page.getByText("CreativeMind is in offline development mode")).toBeVisible();

    // The conversation is listed and the draft opens.
    await expect(page.getByRole("complementary", { name: "Conversations" }).getByRole("link", { name: /Write a poem about the lighthouse/ })).toHaveAttribute("aria-current", "page");
    await card.getByRole("link", { name: /View/ }).click();
    await expect(page.getByRole("article")).not.toBeEmpty();
    await expect(page.getByRole("tab", { name: "Materials (1)" })).toBeVisible();
  });

  test("Creative Discovery: directions → Create this direction", async ({ page }) => {
    await saveNote(page, `Monsoon on the terrace ${uid()}\nMother's radio, the smell of wet earth.`);
    await page.goto("/create/discover");
    await expect(page.getByRole("heading", { name: "Here are some directions you can explore" })).toBeVisible();
    const choose = page.getByRole("region", { name: "Choose material" });
    await expect(choose.getByRole("heading", { name: "Your material (1 selected)" })).toBeVisible();
    await expect(choose.getByRole("button", { pressed: true })).toHaveCount(1);

    await page.getByRole("button", { name: "Show me directions" }).click();
    const directions = page.getByRole("region", { name: "Directions" });
    await expect(directions.getByRole("heading", { level: 3 })).toHaveCount(3, { timeout: 30_000 });
    await expect(directions.getByRole("heading", { name: "A memory-driven short film" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Explore again" })).toBeVisible();

    await directions
      .getByRole("listitem")
      .filter({ has: page.getByRole("heading", { name: "A memory-driven short film" }) })
      .getByRole("button", { name: /Create this direction/ })
      .click();
    await expect(page).toHaveURL(/\/create\?c=[0-9a-f-]{36}$/, { timeout: 45_000 });
    const talk = page.getByRole("region", { name: "meTalk" });
    await expect(talk.getByText(/Create a memory-driven short film/).first()).toBeVisible();
    const card = artifactCard(page);
    await expect(card).toBeVisible();
    await expect(card).toContainText("Short Film");
  });

  test("meTalk: tapping an example puts it in the composer, ready to send or finish in your own words", async ({ page }) => {
    await page.goto("/create");
    const talk = page.getByRole("region", { name: "meTalk" });
    const examples = talk.getByRole("list", { name: "Examples to start from" });
    const box = talk.getByLabel("What are you thinking about?");
    await examples.getByRole("button", { name: /I don't know what this should become/ }).click();
    await expect(box).toHaveValue("I don't know what this should become.");
    await expect(box).toBeFocused();
    await expect(examples.getByRole("button", { name: /I don't know what this should become/ })).toHaveAttribute("aria-pressed", "true");
    // Another one replaces it; nothing is sent until the creator sends.
    await examples.getByRole("button", { name: /Turn these notes into a poem/ }).click();
    await expect(box).toHaveValue("Turn these notes into a poem.");
    await expect(examples.getByRole("button", { name: /I don't know what this should become/ })).toHaveAttribute("aria-pressed", "false");
    await expect(talk.getByRole("button", { name: "Send", exact: true })).toBeEnabled();
  });

  test('meTalk: "Turn these notes into a poem." with a note produces a poem', async ({ page }) => {
    const { artifactId, noteTitle } = await poemFromNote(page);
    const card = artifactCard(page);
    await expect(card).toContainText("Poem");
    // Quality checks are shown with the draft.
    await expect(card.getByText("Structure")).toBeVisible();
    await expect(card.getByText("Drafted by the offline development model (placeholder).")).toBeVisible();

    await card.getByRole("link", { name: /View/ }).click();
    await expect(page).toHaveURL(new RegExp(`/artifacts/${artifactId}$`));
    await expect(page.getByText("v1 In Progress")).toBeVisible();
    await expect(page.getByRole("article")).not.toBeEmpty();
    await page.getByRole("tab", { name: "Materials (1)" }).click();
    await expect(page.getByRole("tabpanel").getByRole("link", { name: noteTitle })).toBeVisible();
  });

  test("search finds a created piece and a note", async ({ page }) => {
    const word = `zephyr${uid()}`;
    await saveNote(page, `${word} in the rigging`);
    // A blank piece created from Space, with the same word in its title.
    await page.goto("/space");
    await page.getByRole("button", { name: "New", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Start a new Creation" });
    await dialog.getByLabel("Kind of Creation").selectOption({ label: "Poem" });
    await dialog.getByLabel("Title").fill(`Song of ${word}`);
    await dialog.getByRole("button", { name: "Open Creative Studio" }).click();
    await expect(page).toHaveURL(/\/artifacts\/[0-9a-f-]{36}\/studio$/);
    const artifactUrl = page.url().replace(/\/studio$/, "");

    await page.getByRole("button", { name: "Search your creativity" }).click();
    const search = page.getByRole("search", { name: "Search" });
    await search.getByRole("textbox", { name: "Search" }).fill(word);
    await expect(search.getByRole("link", { name: `Song of ${word}` })).toBeVisible();
    await expect(search.getByRole("link", { name: `${word} in the rigging` })).toBeVisible();
    await search.getByRole("link", { name: `Song of ${word}` }).click();
    await expect(search).toBeHidden();
    await expect(page).toHaveURL(artifactUrl);
    await expect(page.getByRole("heading", { level: 1, name: `Song of ${word}` })).toBeVisible();

    await page.getByRole("button", { name: "Search your creativity" }).click();
    await page.getByRole("search", { name: "Search" }).getByRole("textbox", { name: "Search" }).fill(`nothing${uid()}`);
    await expect(page.getByRole("search", { name: "Search" }).getByText(/Nothing found for/)).toBeVisible();
  });
});
