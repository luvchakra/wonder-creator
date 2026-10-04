import type { Page } from "@playwright/test";
import { expect, pngBytes, saveNote, seedCarousel, sendItem, test, uid, uploadViaInbox } from "./fixtures";

// The Working Table (owner board, 29 Sep 2026) is pulled up from the bottom bar; pin/select/Use together are under Manage.
const tableBar = (page: Page) => page.getByRole("button", { name: /^Working Table:/ });
async function openTable(page: Page) {
  await tableBar(page).click();
  return page.getByRole("dialog", { name: "Working Table" });
}
async function openSet(page: Page) {
  const table = await openTable(page);
  await table.getByRole("button", { name: /^Manage/ }).click();
  return page.getByRole("dialog", { name: "Working Set" });
}

test.describe("CreativeStudio Working Set", () => {
  test.beforeEach(({ creator }) => void creator);

  test("bring in, use, pin — without leaving the Studio, and it's all still there after a reload", async ({ page }) => {
    const tag = uid();
    await saveNote(page, `Dad waited at Platform 3 every Sunday ${tag}`);
    const title = `Platform 3 ${tag}`;
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title } })).json()).artifact as { id: string };
    await page.goto(`/creations/${art.id}/studio`);
    await expect(page.getByRole("region", { name: "Editor" })).toBeVisible();

    // One compact affordance; an empty table says so with one action.
    await expect(page.getByRole("button", { name: /^Working Table: No sources yet/ })).toBeVisible();
    const table = await openTable(page);
    await expect(table.getByText("Nothing here yet.")).toBeVisible();
    await table.getByRole("button", { name: "Bring in" }).click();

    // One doorway: kinds of source, then search across them, pick several, add.
    const bring = page.getByRole("dialog", { name: "Bring in" });
    await expect(bring.getByRole("list", { name: "Kinds of source" }).getByRole("button")).toHaveCount(11);
    await bring.getByPlaceholder("Search materials, creations, people, web…").fill(tag);
    const materials = bring.getByRole("region", { name: "Materials" });
    await materials.getByRole("checkbox").first().click();
    await expect(bring.getByText("1 selected")).toBeVisible();
    await bring.getByRole("button", { name: "Add to Studio" }).click();

    // It lands on the table, Available; under Manage a tap puts it In use; Pin keeps it as it is.
    await expect(table.getByRole("tab", { name: /Available/ })).toHaveAttribute("aria-selected", "true");
    await expect(table.getByRole("list", { name: "Materials" })).toContainText(tag);
    await table.getByRole("button", { name: /^Manage/ }).click();
    const set = page.getByRole("dialog", { name: "Working Set" });
    const row = set.getByRole("switch").first();
    await expect(row).toHaveAttribute("aria-checked", "false");
    await row.click();
    await expect(row).toHaveAttribute("aria-checked", "true");
    await set.getByRole("button", { name: /^Pin / }).click();
    await expect(set.getByRole("radio", { name: /Pinned/ })).toContainText("1");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /^Working Table: 1 source · 1 in use/ })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: /^Working Table: 1 source · 1 in use/ })).toBeVisible();
    // No new version for any of it.
    const versions = await (await page.request.get(`/api/v1/artifacts/${art.id}/versions`)).json();
    expect(versions.versions).toHaveLength(1);
  });

  test("select two sources → Use together → an idea to use; a comment can be used in the Studio; the format switch keeps the ingredients", async ({ page }) => {
    const tag = uid();
    const n1 = await saveNote(page, `Dad waited at Platform 3 every Sunday ${tag}`);
    const n2 = await saveNote(page, `Station at dusk, lamps and steam ${tag}`);
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title: `Platform 3 ${tag}` } })).json()).artifact as { id: string };
    const s = (await (await page.request.post("/api/v1/studio-sessions", { data: { artifactId: art.id } })).json()).workingSet as { sessionId: string };
    await page.request.post(`/api/v1/studio-sessions/${s.sessionId}/sources`, {
      data: {
        items: [
          { type: "material", id: n1 },
          { type: "material", id: n2 },
        ],
      },
    });
    // A collaborator's comment → "Use in Studio" lands it on the table, In use.
    const c = (await (await page.request.post(`/api/v1/artifacts/${art.id}/comments`, { data: { body: "The opening should feel emptier." } })).json()) as { comment?: { id: string }; id?: string };
    const commentId = c.comment?.id ?? c.id!;
    await page.goto(`/creations/${art.id}/studio?add=comment:${commentId}`);
    await expect(page.getByRole("button", { name: /^Working Table: 3 sources · 1 in use/ })).toBeVisible();

    // Use together: pick the two notes, one dominant action, one idea, directions from the roles.
    const set = await openSet(page);
    await set.getByRole("checkbox", { name: /Select Dad waited/ }).click();
    await set.getByRole("checkbox", { name: /Select Station at dusk/ }).click();
    await set.getByRole("button", { name: /Use together/ }).click();
    // First, how each one is used — one question per source, with Back — then what they could become together.
    const how = page.getByRole("dialog", { name: "How do you want to use this?" });
    await expect(how).toContainText("1 of 2");
    await how
      .getByRole("radiogroup", { name: "Ways to use it" })
      .getByRole("radio", { name: /Follow its shape/ })
      .click();
    await how.getByRole("button", { name: /^Next/ }).click();
    await expect(how).toContainText("2 of 2");
    await how.getByRole("button", { name: /Back/ }).click();
    await expect(how).toContainText("1 of 2");
    await expect(how.getByRole("radio", { name: /Follow its shape/ })).toHaveAttribute("aria-checked", "true");
    await how.getByRole("button", { name: /^Next/ }).click();
    await how.getByLabel("How you'd like to use it").fill("the lamps, for the last line");
    await how.getByRole("button", { name: /Use them together/ }).click();
    await expect(how).toHaveCount(0);
    const together = page.getByRole("dialog", { name: "2 sources selected" });
    await expect(together.getByRole("radiogroup", { name: "Directions" }).getByRole("radio").first()).toHaveAttribute("aria-checked", "true");
    await together.getByRole("radio", { name: /^Poem/ }).click();
    await together.getByRole("button", { name: /Use this idea/ }).click();
    // Both are now In use (the direction is the same kind of Creation, so no switch is offered here).
    await expect(page.getByRole("button", { name: /^Working Table: 3 sources · 3 in use/ })).toBeVisible();

    // Change format: a new Creation from the same ingredients; its Studio has the same table plus this one.
    // On the Writing page, Change format lives in More (creation-pages.md).
    await page.getByRole("button", { name: "More", exact: true }).click();
    await page.getByRole("dialog", { name: "Save, version and publish" }).getByRole("button", { name: /Change format/ }).click();
    const format = page.getByRole("dialog", { name: "Make a new Creation" });
    await format.getByRole("radio", { name: /Carousel/ }).click();
    await format.getByRole("button", { name: "Create a new carousel" }).click();
    await page.waitForURL((u) => /\/creations\/[0-9a-f-]{36}\/(?:studio|write)$/.test(u.pathname) && !u.pathname.includes(art.id), { timeout: 60_000 });
    await expect(page.getByRole("button", { name: /^Working Table: 4 sources · 4 in use/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Carousel/ }).first()).toBeVisible();
    // A separate Creation: it says so and links back; the original is still the poem it was.
    await page.getByRole("status").filter({ hasText: "is unchanged" }).getByRole("link", { name: "open it" }).click();
    await page.waitForURL(new RegExp(`/creations/${art.id}/(?:studio|write)$`));
    const original = (await (await page.request.get(`/api/v1/artifacts/${art.id}`)).json()) as { artifact: { artifact_type: string } };
    expect(original.artifact.artifact_type).toBe("poem");
  });

  test("every source is a card on the Working Table; any can be opened or closed (all closed too), and the device remembers", async ({ page }) => {
    const tag = uid();
    const a = await saveNote(page, `Rain on the platform roof ${tag}\nA slow drip into the puddles.`);
    const b = await saveNote(page, `The chai seller's radio ${tag}\nOld film songs, half heard.`);
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title: `Platform ${tag}` } })).json()).artifact as { id: string };
    const { workingSet } = (await (await page.request.post("/api/v1/studio-sessions", { data: { artifactId: art.id } })).json()) as { workingSet: { sessionId: string } };
    await page.request.post(`/api/v1/studio-sessions/${workingSet.sessionId}/sources`, {
      data: {
        items: [
          { type: "material", id: a },
          { type: "material", id: b },
        ],
      },
    });

    await page.goto(`/creations/${art.id}/studio`);
    // A clean canvas: nothing sits under it until the table is pulled up.
    await expect(page.getByRole("list", { name: "Materials" })).toHaveCount(0);
    let panel = await openTable(page);
    // Nothing is in use yet, so the table opens on Available.
    await expect(panel.getByRole("tab", { name: /Available/ })).toHaveAttribute("aria-selected", "true");
    const rows = panel.locator("li > button[aria-expanded]");
    await expect(rows).toHaveCount(2);
    await expect(panel.locator('li > button[aria-expanded="true"]')).toHaveCount(0);
    // Just brought in: marked New, with its own one-tap uses.
    await expect(panel.getByText("New", { exact: true })).toHaveCount(2);
    await expect(panel.getByRole("group", { name: /^Use The chai seller's radio/ }).getByRole("button", { name: "Add to draft" })).toBeVisible();

    const radio = rows.filter({ hasText: "The chai seller's radio" });
    await radio.click();
    await expect(radio).toHaveAttribute("aria-expanded", "true");
    await expect(panel.getByText("Old film songs, half heard.")).toBeVisible();
    await rows.filter({ hasText: "Rain on the platform roof" }).click();
    await expect(panel.locator('li > button[aria-expanded="true"]')).toHaveCount(1);
    await page.reload();
    panel = await openTable(page);
    const rain = panel.locator("li > button[aria-expanded]").filter({ hasText: "Rain on the platform roof" });
    await expect(rain).toHaveAttribute("aria-expanded", "true");
    // Closing the open one leaves them all closed, and that's remembered too.
    await rain.click();
    await expect(panel.locator('li > button[aria-expanded="true"]')).toHaveCount(0);
    await page.reload();
    panel = await openTable(page);
    await expect(panel.locator("li > button[aria-expanded]")).toHaveCount(2);
    await expect(panel.locator('li > button[aria-expanded="true"]')).toHaveCount(0);
  });

  test("Use this asks how: options from what the source is, or the creator's own words, and the row says so", async ({ page }) => {
    const tag = uid();
    const a = await saveNote(page, `Rain on the platform roof ${tag}\nA slow drip into the puddles.`);
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title: `Platform ${tag}` } })).json()).artifact as { id: string };
    const { workingSet } = (await (await page.request.post("/api/v1/studio-sessions", { data: { artifactId: art.id } })).json()) as { workingSet: { sessionId: string } };
    await page.request.post(`/api/v1/studio-sessions/${workingSet.sessionId}/sources`, { data: { items: [{ type: "material", id: a }] } });
    await page.goto(`/creations/${art.id}/studio`);
    const sheet = await openSet(page);
    await sheet.getByRole("checkbox", { name: /^Select Rain on the platform roof/ }).click();
    await sheet.getByRole("button", { name: /Use this/ }).click();

    const how = page.getByRole("dialog", { name: "How do you want to use this?" });
    const ways = how.getByRole("radiogroup", { name: "Ways to use it" });
    await expect(ways.getByRole("radio", { name: /Use its words/ })).toHaveAttribute("aria-checked", "true");
    await expect(ways.getByRole("radio", { name: /Follow its shape/ })).toBeVisible();
    // Nothing fits? Say it in your own words.
    await how.getByLabel("How you'd like to use it").fill("only the sound of the rain, for the opening");
    await expect(ways.getByRole("radio", { name: "Something else…" })).toHaveAttribute("aria-checked", "true");
    await how.getByRole("button", { name: /Use it/ }).click();
    await expect(how).toHaveCount(0);
    const panel = await openTable(page);
    await expect(panel).toContainText("“only the sound of the rain, for the opening”");

    // Back again: a listed option replaces the note.
    await panel.getByRole("button", { name: /^Manage/ }).click();
    await sheet.getByRole("checkbox", { name: /^Select Rain on the platform roof/ }).click();
    await sheet.getByRole("button", { name: /Use this/ }).click();
    await ways.getByRole("radio", { name: /Follow its shape/ }).click();
    await how.getByRole("button", { name: /Use it/ }).click();
    await expect(how).toHaveCount(0);
    await openTable(page);
    await expect(panel).toContainText("Its shape");
    await page.reload();
    await expect(await openTable(page)).toContainText("Its shape");
  });
  test("choosing a use makes it happen — writing: words go into the draft; a tone becomes a CreativeMind revision", async ({ page }) => {
    const tag = uid();
    const a = await saveNote(page, `The chai seller's radio ${tag}\nOld film songs, half heard.`);
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title: `Platform ${tag}`, content: "Every Sunday my father waited." } })).json()).artifact as {
      id: string;
    };
    const { workingSet } = (await (await page.request.post("/api/v1/studio-sessions", { data: { artifactId: art.id } })).json()) as { workingSet: { sessionId: string } };
    await page.request.post(`/api/v1/studio-sessions/${workingSet.sessionId}/sources`, { data: { items: [{ type: "material", id: a }] } });
    await page.goto(`/creations/${art.id}/studio`);
    const sheet = page.getByRole("dialog", { name: "Working Set" });
    const how = page.getByRole("dialog", { name: "How do you want to use this?" });

    // A tone steers: CreativeMind proposes a revision from the source (offline: a labelled placeholder) to keep or discard.
    await openSet(page);
    await sheet.getByRole("checkbox", { name: /^Select The chai seller/ }).click();
    await sheet.getByRole("button", { name: /Use this/ }).click();
    await how.getByRole("radio", { name: /Take its tone and voice/ }).click();
    await how.getByRole("button", { name: /Use it/ }).click();
    await expect(page.getByRole("button", { name: "Keep revision" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("status").filter({ hasText: /CreativeMind is working/ })).toBeVisible();
    await page.getByRole("button", { name: "Discard" }).click();

    // Its words go straight into the draft.
    await openSet(page);
    await sheet.getByRole("checkbox", { name: /^Select The chai seller/ }).click();
    await sheet.getByRole("button", { name: /Use this/ }).click();
    await how.getByRole("radio", { name: /^Use its words/ }).click();
    await how.getByRole("button", { name: /Use it/ }).click();
    await expect(page.getByLabel("Poem text")).toHaveValue(/Every Sunday my father waited\.\n\nThe chai seller's radio .*\nOld film songs, half heard\./);
    await expect(page.getByRole("status").filter({ hasText: "Its words are in your draft." })).toBeVisible();
  });

  test("choosing a use makes it happen — carousel: your photo is offered on the slide; words go onto it", async ({ page, creator }) => {
    const tag = uid();
    const name = `station-${tag}`;
    await uploadViaInbox(page, [{ name: `${name}.png`, mimeType: "image/png", buffer: pngBytes(64) }]);
    const item = sendItem(page, name);
    await expect(item.getByLabel("Ready")).toBeVisible({ timeout: 30_000 });
    const photo = (await item.getByRole("link", { name, exact: true }).getAttribute("href"))!.split("/").pop()!;
    const note = await saveNote(page, `Lamps and steam ${tag}\nThe platform hums.`);
    const id = (
      (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "carousel", title: `Station ${tag}`, content: "First light\n\nSecond wind" } })).json()).artifact as { id: string }
    ).id;
    await seedCarousel(creator.id, id, ["First light", "Second wind"]);
    const { workingSet } = (await (await page.request.post("/api/v1/studio-sessions", { data: { artifactId: id } })).json()) as { workingSet: { sessionId: string } };
    await page.request.post(`/api/v1/studio-sessions/${workingSet.sessionId}/sources`, {
      data: {
        items: [
          { type: "material", id: photo },
          { type: "material", id: note },
        ],
      },
    });

    await page.goto(`/creations/${id}/studio`);
    const editor = page.getByRole("region", { name: "Editor" });
    const sheet = page.getByRole("dialog", { name: "Working Set" });
    const how = page.getByRole("dialog", { name: "How do you want to use this?" });
    await openSet(page);
    await sheet.getByRole("checkbox", { name: new RegExp(`^Select ${name}`) }).click();
    await sheet.getByRole("button", { name: /Use this/ }).click();
    await expect(how.getByRole("radio", { name: /Use it as a slide image/ })).toHaveAttribute("aria-checked", "true");
    await how.getByRole("button", { name: /Use it/ }).click();
    // Chosen, so placed: straight onto the slide, no Keep current / Use new step.
    await expect(page.getByRole("status").filter({ hasText: "Your photo is on the slide" })).toBeVisible({ timeout: 30_000 });
    await expect(editor.getByRole("region", { name: "New image for this slide" })).toHaveCount(0);
    const before = (await (await page.request.get(`/api/v1/carousels/${id}`)).json()) as { slides: Array<{ pending: unknown; image: { url: string } | null }> };
    expect(before.slides[0]!.pending).toBeNull();
    expect(before.slides[0]!.image).not.toBeNull();

    // Words onto the slide on screen.
    await openSet(page);
    await sheet.getByRole("checkbox", { name: /^Select Lamps and steam/ }).click();
    await sheet.getByRole("button", { name: /Use this/ }).click();
    await how.getByRole("radio", { name: /Put its words on this slide/ }).click();
    await how.getByRole("button", { name: /Use it/ }).click();
    await expect(editor.getByRole("link", { name: /^Edit slide 1 of 2: Lamps and steam/ })).toBeVisible({ timeout: 15_000 });
    // …and onto the image: the overlay is switched on.
    const after = (await (await page.request.get(`/api/v1/carousels/${id}`)).json()) as { slides: Array<{ overlay: { enabled: boolean } }> };
    expect(after.slides[0]!.overlay.enabled).toBe(true);
  });
  test("one-tap uses under each material act on the carousel: add as new slide, split into slides, set as cover", async ({ page, creator }) => {
    const tag = uid();
    const name = `platform-${tag}`;
    await uploadViaInbox(page, [{ name: `${name}.png`, mimeType: "image/png", buffer: pngBytes(64) }]);
    const item = sendItem(page, name);
    await expect(item.getByLabel("Ready")).toBeVisible({ timeout: 30_000 });
    const photo = (await item.getByRole("link", { name, exact: true }).getAttribute("href"))!.split("/").pop()!;
    const note = await saveNote(page, `Lamps ${tag}\nsteam on the glass\n\nThe platform hums\nand nobody leaves\n\nA whistle, then silence`);
    const id = (
      (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "carousel", title: `Station ${tag}`, content: "First light\n\nSecond wind" } })).json()).artifact as { id: string }
    ).id;
    await seedCarousel(creator.id, id, ["First light", "Second wind"]);
    const { workingSet } = (await (await page.request.post("/api/v1/studio-sessions", { data: { artifactId: id } })).json()) as { workingSet: { sessionId: string } };
    await page.request.post(`/api/v1/studio-sessions/${workingSet.sessionId}/sources`, {
      data: {
        items: [
          { type: "material", id: photo },
          { type: "material", id: note },
        ],
      },
    });

    await page.goto(`/creations/${id}/studio`);
    const editor = page.getByRole("region", { name: "Editor" });
    const panel = await openTable(page);
    const photoActions = panel.getByRole("group", { name: new RegExp(`^Use ${name}`) });
    await expect(photoActions.getByRole("button")).toHaveText(["Add as new slide", "Replace slide image", "Set as cover"]);

    // Add as new slide: a slide right after this one, with the photo, and the canvas moves to it; the table steps aside.
    await photoActions.getByRole("button", { name: "Add as new slide" }).click();
    await expect(panel).toHaveCount(0);
    await expect(editor.getByText("2 / 3")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("status").filter({ hasText: "A new slide with your photo" })).toBeVisible();

    // Set as cover (it's In use now, so the table opens there).
    await openTable(page);
    await photoActions.getByRole("button", { name: "Set as cover" }).click();
    await expect(page.getByRole("status").filter({ hasText: "is the cover now" })).toBeVisible();

    // Split into slides: the note's three passages go onto slides from the one on screen onward.
    await editor.getByRole("list", { name: "Slides" }).getByRole("button", { name: "Slide 1 of 3" }).click();
    await openTable(page);
    await panel.getByRole("tab", { name: /Available/ }).click();
    const noteActions = panel.getByRole("group", { name: new RegExp(`^Use Lamps ${tag}`) });
    await expect(noteActions.getByRole("button")).toHaveText(["Use on slide", "Split into slides", "Refine slide text"]);
    await noteActions.getByRole("button", { name: "Split into slides" }).click();
    await expect(page.getByRole("status").filter({ hasText: "Split across 3 slides" })).toBeVisible({ timeout: 15_000 });
    await expect(editor.getByRole("link", { name: /^Edit slide 1 of 3: Lamps/ })).toBeVisible();
    // Used now: the card says how.
    await openTable(page);
    await expect(panel).toContainText("Its shape");
  });
  test("See more on a Working Table card leads back to the Studio; pictures come through stable, cached links", async ({ page }) => {
    const tag = uid();
    const name = `window-${tag}`;
    await uploadViaInbox(page, [{ name: `${name}.png`, mimeType: "image/png", buffer: pngBytes(64) }]);
    const item = sendItem(page, name);
    await expect(item.getByLabel("Ready")).toBeVisible({ timeout: 30_000 });
    const photo = (await item.getByRole("link", { name, exact: true }).getAttribute("href"))!.split("/").pop()!;
    const title = `Platform ${tag}`;
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title, content: "Every Sunday." } })).json()).artifact as { id: string };
    const { workingSet } = (await (await page.request.post("/api/v1/studio-sessions", { data: { artifactId: art.id } })).json()) as { workingSet: { sessionId: string } };
    await page.request.post(`/api/v1/studio-sessions/${workingSet.sessionId}/sources`, { data: { items: [{ type: "material", id: photo }] } });
    await page.goto(`/creations/${art.id}/studio`);
    const panel = await openTable(page);

    // The picture is a stable link (the same on every load), privately cacheable.
    const img = panel.getByRole("list", { name: "Materials" }).locator("img").first();
    await expect(img).toHaveAttribute("src", /^\/api\/v1\/media\/[0-9a-f-]{36}\?e=\d+&s=/);
    const src = (await img.getAttribute("src"))!;
    const res = await page.request.get(src, { maxRedirects: 0 });
    expect(res.status()).toBe(302);
    expect(res.headers()["cache-control"]).toMatch(/^private, max-age=\d+, immutable$/);
    expect((await page.request.get(src.replace(/s=[^&]+/, "s=forged"), { maxRedirects: 0 })).status()).toBe(404);
    await page.reload();
    await expect((await openTable(page)).getByRole("list", { name: "Materials" }).locator("img").first()).toHaveAttribute("src", src);

    // See more → the material, with a way back to this Studio.
    await panel.locator("li > button[aria-expanded]").filter({ hasText: name }).click();
    await panel.getByRole("link", { name: "See more" }).click();
    await expect(page).toHaveURL(new RegExp(`/materials/${photo}\\?from=studio:${art.id}$`));
    await page.getByRole("link", { name: `Back to ${title}` }).click();
    await expect(page).toHaveURL(new RegExp(`/creations/${art.id}/(?:studio|write)$`));
  });

  test("External: royalty-free pictures are searched on the table, with honest states for services that aren't connected", async ({ page }) => {
    const tag = uid();
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "carousel", title: `Monsoon ${tag}` } })).json()).artifact as { id: string };
    await page.goto(`/creations/${art.id}/studio`);
    const table = await openTable(page);
    await table.getByRole("tab", { name: "External" }).click();
    // The search starts from the Creation's own title.
    await expect(table.getByLabel("Search royalty-free pictures")).toHaveValue(`Monsoon ${tag}`);
    // Without a key a service says so (never fake results).
    const providers = table.getByRole("radiogroup", { name: /picture/i });
    await providers.getByRole("radio", { name: /Pixabay/ }).click();
    await expect(table.getByText(/Pixabay isn't connected/)).toBeVisible();
    // The API is equally honest.
    const r = await (await page.request.get(`/api/v1/external-images?provider=unsplash&q=rain`)).json();
    expect(r.connected).toBe(false);
    expect(r.results).toEqual([]);
  });
});
