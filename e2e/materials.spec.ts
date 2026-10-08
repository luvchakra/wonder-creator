import { strToU8, zipSync } from "fflate";
import { expect, pngBytes, saveNote, sendItem, test, uid, uploadViaInbox, wavBytes, type Page } from "./fixtures";

const HTML_MEDIA_HAVE_METADATA = 1;

test.describe("CreatorSend & material", () => {
  // Every test runs as a fresh, onboarded creator.
  test.beforeEach(({ creator }) => void creator);

  test("image upload through the inbox becomes Ready and appears in Space", async ({ page }) => {
    const name = `sunrise-${uid()}`;
    await uploadViaInbox(page, [{ name: `${name}.png`, mimeType: "image/png", buffer: pngBytes() }]);

    const item = sendItem(page, name);
    await expect(item).toBeVisible();
    await expect(item.getByText(/^Image ·/)).toBeVisible();
    await expect(item.getByLabel("Ready")).toBeVisible({ timeout: 30_000 });

    // Palette → Materials shows it as an image card.
    await page.getByRole("button", { name: "Open Creative Palette" }).click();
    await page.getByRole("dialog", { name: "Creative Palette" }).getByRole("button", { name: "Materials" }).click();
    await expect(page).toHaveURL(/\/materials\?tab=ideas$/);
    const card = page.getByRole("link").filter({ hasText: name });
    await expect(card).toBeVisible();
    await expect(card).toContainText("Image");
    await page.getByRole("navigation", { name: "Material type" }).getByRole("link", { name: /Photos/ }).click();
    await expect(page.getByRole("navigation", { name: "Material type" }).getByRole("link", { name: /Photos/ })).toContainText("1");
    await card.click();

    // Material page: the image and its name; status & provenance under Details › About the file.
    await expect(page).toHaveURL(/\/materials\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.locator("main img").first()).toBeVisible();
    await expect.poll(() => page.locator("main img").first().evaluate((i: HTMLImageElement) => i.naturalWidth)).toBeGreaterThan(0);
    const facts = await aboutTheFile(page);
    await expect(facts).toContainText("Ready");
    await expect(facts).toContainText("Uploaded");
    await expect(facts).toContainText(`${name}.png`);
    await expect(facts).toContainText("image/png");
  });

  test("a WAV file is stored as audio and is playable on its material page", async ({ page }) => {
    const name = `voice-${uid()}`;
    await uploadViaInbox(page, [{ name: `${name}.wav`, mimeType: "audio/wav", buffer: wavBytes() }]);
    const item = sendItem(page, name);
    await expect(item.getByText(/^Audio ·/)).toBeVisible();
    await expect(item.getByLabel("Ready")).toBeVisible({ timeout: 30_000 });

    await page.goto("/materials?tab=ideas&type=audio");
    const card = page.getByRole("link").filter({ hasText: name });
    await expect(card).toContainText("Audio");
    await card.click();

    const audio = page.locator("main audio[controls]");
    await expect(audio).toBeVisible();
    await expect(audio).toHaveAttribute("src", /.+/);
    // The signed URL really serves playable audio.
    await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => (a.error ? -1 : a.readyState))).toBeGreaterThanOrEqual(HTML_MEDIA_HAVE_METADATA);
    await expect.poll(() => audio.evaluate((a: HTMLAudioElement) => a.duration)).toBeCloseTo(0.25, 1);
    const facts = await aboutTheFile(page);
    await expect(facts).toContainText("audio/wav");
    await expect(facts).toContainText("Ready");
    await expect(page.getByRole("dialog", { name: "Details" }).getByText("Transcription isn't available with the current AI setup. The original is saved and playable.")).toBeVisible();
  });

  test("a Word document's text is extracted onto its material page", async ({ page }) => {
    const name = `draft-${uid()}`;
    const docx = zipSync({
      "[Content_Types].xml": strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),
      "word/document.xml": strToU8('<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Rain on the ghats &amp; the evening bells.</w:t></w:r></w:p></w:body></w:document>'),
    });
    await uploadViaInbox(page, [{ name: `${name}.docx`, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", buffer: Buffer.from(docx) }]);
    const item = sendItem(page, name);
    await expect(item.getByLabel("Ready")).toBeVisible({ timeout: 30_000 });

    await page.goto("/materials?tab=ideas");
    await page.getByRole("link").filter({ hasText: name }).click();
    await expect(page).toHaveURL(/\/materials\/[0-9a-f-]{36}$/);
    await page.getByText("Extracted text").click();
    await expect(page.getByText("Rain on the ghats & the evening bells.")).toBeVisible();
  });

  test("links to private networks and malformed links are rejected with a readable message", async ({ page }) => {
    await page.goto("/send");
    const links = page.getByLabel("Paste links");
    const add = page.getByRole("button", { name: "Add", exact: true });
    const rejections = page.getByRole("main").getByRole("alert");

    await links.fill("http://localhost:3000/space");
    await add.click();
    await expect(links).toHaveValue("");
    await expect(rejections).toContainText("http://localhost:3000/space");
    await expect(rejections).toContainText(/Links to non-standard ports can't be added\.|That link points to a private network\./);

    await links.fill("http://localhost/admin");
    await add.click();
    await expect(links).toHaveValue("");
    await expect(rejections).toContainText("http://localhost/admin — That link points to a private network.");

    await links.fill("http://127.0.0.1/");
    await add.click();
    await expect(links).toHaveValue("");
    await expect(rejections).toContainText("http://127.0.0.1/ — That link points to a private network.");

    await links.fill("not-a-link");
    await add.click();
    await expect(links).toHaveValue("");
    await expect(rejections).toContainText("not-a-link — That doesn't look like a link.");

    await links.fill("ftp://example.com/file.txt");
    await add.click();
    await expect(links).toHaveValue("");
    await expect(rejections).toContainText("Only web links (http or https) can be added.");

    // Nothing was stored.
    await page.reload();
    await expect(page.getByText("Nothing sent yet. Everything you bring in will show its progress here.")).toBeVisible();
  });

  test("deleting material asks for confirmation first", async ({ page }) => {
    const text = `Salt on the window, ${uid()}`;
    const id = await saveNote(page, text);
    await page.goto(`/materials/${id}`);
    await expect(page.getByLabel("Text")).toHaveValue(text);

    await page.getByRole("button", { name: "Details" }).click();
    await page.getByRole("button", { name: "Delete" }).click();
    const dialog = page.getByRole("dialog", { name: "Delete this material permanently?" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText("This can't be undone.");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await page.reload();
    await expect(page.getByLabel("Text")).toHaveValue(text);

    await page.getByRole("button", { name: "Details" }).click();
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("dialog", { name: "Delete this material permanently?" }).getByRole("button", { name: "Delete permanently" }).click();
    await expect(page).toHaveURL(/\/materials\?tab=ideas$/);
    await expect(page.getByRole("link").filter({ hasText: text })).toHaveCount(0);

    await page.goto(`/materials/${id}`);
    await expect(page.getByRole("heading", { name: "We couldn't find that" })).toBeVisible();
  });

  test("Use in creation opens Make a new Creation with the note's words; the Creation starts with them and keeps the note as its source", async ({ page }) => {
    const tag = uid();
    const text = `Rain on the tin roof ${tag}\nThe sound arrives before the train.`;
    const id = await saveNote(page, text);
    await page.goto(`/materials/${id}`);
    await page.getByRole("button", { name: "Use in creation" }).click();
    // The same sheet as the Palette's Create, with the words above the formats.
    const sheet = page.getByRole("dialog", { name: "Make a new Creation" });
    await expect(sheet.getByText(new RegExp(`Rain on the tin roof ${tag}`))).toBeVisible();
    await expect(sheet.getByRole("list", { name: "Formats" }).getByRole("button")).toHaveCount(6);
    // Only the formats: a Room or a new capture wouldn't carry the note.
    await expect(sheet.getByRole("link", { name: /Collaborate with others/ })).toHaveCount(0);
    await expect(sheet.getByRole("link", { name: /bring in Material/ })).toHaveCount(0);
    await sheet.getByRole("button", { name: /^Writing/ }).click();
    await expect(page).toHaveURL(/\/creations\/[0-9a-f-]{36}/);
    const artifactId = /\/creations\/([0-9a-f-]{36})/.exec(page.url())![1];
    // The first draft is the note's words, and the note is recorded as the source.
    const { versions } = (await (await page.request.get(`/api/v1/artifacts/${artifactId}/versions`)).json()) as { versions: Array<{ content: string }> };
    expect(versions[0]!.content).toContain(`Rain on the tin roof ${tag}`);
    expect(versions[0]!.content).toContain("The sound arrives before the train.");
    await page.goto(`/materials/${id}`);
    await expect(page.getByText(/in 1 Creation/)).toBeVisible();
  });

  test("edit a note's title, text and tags", async ({ page }) => {
    const text = `Harbour lights ${uid()}`;
    const id = await saveNote(page, text);
    await page.goto(`/materials/${id}`);
    // The words are the page; Save appears only once they change (and Use in creation steps aside meanwhile).
    await page.getByLabel("Text").fill(`${text}\nThe ferry horn at dusk.`);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Use in creation" })).toBeVisible();
    // The title and tags are under Details.
    await page.getByRole("button", { name: "Details" }).click();
    const details = page.getByRole("dialog", { name: "Details" });
    await details.getByLabel("Title").fill("Harbour notebook");
    await details.getByLabel("Tags").fill("sea");
    await details.getByLabel("Tags").press("Enter");
    await details.getByRole("button", { name: "Save changes" }).click();
    await expect(details.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();
    await page.reload();
    await expect(page.getByRole("heading", { level: 1, name: "Harbour notebook" })).toBeVisible();
    await expect(page.getByLabel("Text")).toHaveValue(`${text}\nThe ferry horn at dusk.`);
    await page.getByRole("button", { name: "Details" }).click();
    await expect(page.getByRole("button", { name: "Remove sea" })).toBeVisible();
  });

  test("material detail: description, source note, collections, download", async ({ page }) => {
    const name = `tide-${uid()}`;
    const collection = `Coast ${uid()}`;
    expect((await page.request.post("/api/v1/collections", { data: { name: collection } })).ok()).toBe(true);
    await uploadViaInbox(page, [{ name: `${name}.png`, mimeType: "image/png", buffer: pngBytes() }]);
    await expect(sendItem(page, name).getByLabel("Ready")).toBeVisible({ timeout: 30_000 });
    await page.goto("/materials?tab=ideas");
    await page.getByRole("link").filter({ hasText: name }).click();
    await expect(page).toHaveURL(/\/materials\/[0-9a-f-]{36}$/);

    // The page is just the picture, its name and one action; Details holds the rest (owner, 4 Oct 2026).
    await expect(page.getByLabel("Description")).toHaveCount(0);
    const facts = await aboutTheFile(page);
    await expect(facts).toContainText("Private to you");
    await expect(facts).toContainText("Owner");

    await page.getByLabel("Description").fill("Low tide colours for the album cover.");
    await page.getByLabel("Source & rights note").fill("My own photo.");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Saved." })).toBeVisible();

    await expect(page.getByText("Not in a collection yet.")).toBeVisible();
    await page.getByLabel("Collection", { exact: true }).selectOption({ label: collection });
    await page.getByRole("button", { name: "Add to collection" }).click();
    await expect(page.getByRole("status").filter({ hasText: `Added to ${collection}.` })).toBeVisible();

    await page.reload();
    await page.getByRole("button", { name: "Details" }).click();
    await expect(page.getByLabel("Description")).toHaveValue("Low tide colours for the album cover.");
    await expect(page.getByLabel("Source & rights note")).toHaveValue("My own photo.");
    await expect(page.getByRole("list", { name: "In collections" })).toContainText(collection);
    await page.getByRole("button", { name: `Remove from ${collection}` }).click();
    await expect(page.getByText("Not in a collection yet.")).toBeVisible();

    // The original downloads under its filename; the link is short-lived and owner-only.
    const download = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download original" }).click();
    expect((await download).suggestedFilename()).toBe(`${name}.png`);
  });
});

/** Open Details and its "About the file" fold; returns the facts list. */
async function aboutTheFile(page: Page) {
  await page.getByRole("button", { name: "Details" }).click();
  const details = page.getByRole("dialog", { name: "Details" });
  await details.getByText("About the file").click();
  return details.locator("dl").first();
}
