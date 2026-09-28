import { expect, pngBytes, saveNote, seedCarousel, sendItem, test, uid, uploadViaInbox } from "./fixtures";

test.describe("CreativeStudio Working Set", () => {
  test.beforeEach(({ creator }) => void creator);

  test("bring in, use, pin — without leaving the Studio, and it's all still there after a reload", async ({ page }) => {
    const tag = uid();
    await saveNote(page, `Dad waited at Platform 3 every Sunday ${tag}`);
    const title = `Platform 3 ${tag}`;
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title } })).json()).artifact as { id: string };
    await page.goto(`/artifacts/${art.id}/studio`);
    await expect(page.getByRole("region", { name: "Editor" })).toBeVisible();

    // One compact affordance; an empty table says so with one action.
    await page.getByRole("button", { name: /^Working Set: No sources yet/ }).click();
    const sheet = page.getByRole("dialog", { name: "Working Set" });
    await expect(sheet.getByText("Nothing here yet.")).toBeVisible();
    await sheet.getByRole("button", { name: "Bring in" }).click();

    // One doorway: kinds of source, then search across them, pick several, add.
    const bring = page.getByRole("dialog", { name: "Bring in" });
    await expect(bring.getByRole("list", { name: "Kinds of source" }).getByRole("button")).toHaveCount(8);
    await bring.getByPlaceholder("Search materials, creations, people, web…").fill(tag);
    const materials = bring.getByRole("region", { name: "Materials" });
    await materials.getByRole("checkbox").first().click();
    await expect(bring.getByText("1 selected")).toBeVisible();
    await bring.getByRole("button", { name: "Add to Studio" }).click();

    // It lands Available; a tap puts it In use; Pin keeps it as it is.
    const set = page.getByRole("dialog", { name: "Working Set" });
    const row = set.getByRole("switch").first();
    await expect(row).toHaveAttribute("aria-checked", "false");
    await row.click();
    await expect(row).toHaveAttribute("aria-checked", "true");
    await set.getByRole("button", { name: /^Pin / }).click();
    await expect(set.getByRole("radio", { name: /Pinned/ })).toContainText("1");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("button", { name: /^Working Set: 1 source · 1 in use/ })).toBeVisible();

    await page.reload();
    await expect(page.getByRole("button", { name: /^Working Set: 1 source · 1 in use/ })).toBeVisible();
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
    await page.goto(`/artifacts/${art.id}/studio?add=comment:${commentId}`);
    await expect(page.getByRole("button", { name: /^Working Set: 3 sources · 1 in use/ })).toBeVisible();

    // Use together: pick the two notes, one dominant action, one idea, directions from the roles.
    await page.getByRole("button", { name: /^Working Set:/ }).click();
    const set = page.getByRole("dialog", { name: "Working Set" });
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
    await expect(page.getByRole("button", { name: /^Working Set: 3 sources · 3 in use/ })).toBeVisible();

    // Change format: a new Creation from the same ingredients; its Studio has the same table plus this one.
    await page.getByRole("button", { name: /Writing/ }).click();
    const format = page.getByRole("dialog", { name: "Change format" });
    await format.getByRole("radio", { name: /Carousel/ }).click();
    await format.getByRole("button", { name: "Make it a carousel" }).click();
    await page.waitForURL((u) => /\/artifacts\/[0-9a-f-]{36}\/studio$/.test(u.pathname) && !u.pathname.includes(art.id), { timeout: 60_000 });
    await expect(page.getByRole("button", { name: /^Working Set: 4 sources · 4 in use/ })).toBeVisible();
    await expect(page.getByRole("button", { name: /Carousel/ }).first()).toBeVisible();
  });

  test("every source shows under the canvas, collapsed but for the last one opened — and the device remembers which", async ({ page }) => {
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

    await page.goto(`/artifacts/${art.id}/studio`);
    const panel = page.getByRole("region", { name: /^Used materials/ });
    const rows = panel.getByRole("button", { expanded: undefined }).filter({ has: page.locator("[aria-expanded]") });
    void rows;
    const all = panel.locator("button[aria-expanded]");
    await expect(all).toHaveCount(2);
    await expect(panel.locator('button[aria-expanded="true"]')).toHaveCount(1);

    // Opening another closes the first and shows what it holds; the choice survives a reload.
    const radio = panel.locator("button[aria-expanded]").filter({ hasText: "The chai seller's radio" });
    if ((await radio.getAttribute("aria-expanded")) !== "true") await radio.click();
    await expect(radio).toHaveAttribute("aria-expanded", "true");
    await expect(panel.locator('button[aria-expanded="true"]')).toHaveCount(1);
    await expect(panel.getByText("Old film songs, half heard.")).toBeVisible();
    await page.reload();
    await expect(
      page
        .getByRole("region", { name: /^Used materials/ })
        .locator("button[aria-expanded]")
        .filter({ hasText: "The chai seller's radio" }),
    ).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("region", { name: /^Used materials/ }).locator('button[aria-expanded="true"]')).toHaveCount(1);
  });
  test("Use this asks how: options from what the source is, or the creator's own words, and the row says so", async ({ page }) => {
    const tag = uid();
    const a = await saveNote(page, `Rain on the platform roof ${tag}\nA slow drip into the puddles.`);
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title: `Platform ${tag}` } })).json()).artifact as { id: string };
    const { workingSet } = (await (await page.request.post("/api/v1/studio-sessions", { data: { artifactId: art.id } })).json()) as { workingSet: { sessionId: string } };
    await page.request.post(`/api/v1/studio-sessions/${workingSet.sessionId}/sources`, { data: { items: [{ type: "material", id: a }] } });
    await page.goto(`/artifacts/${art.id}/studio`);
    await page.getByRole("button", { name: /^Working Set:/ }).click();
    const sheet = page.getByRole("dialog", { name: "Working Set" });
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
    const panel = page.getByRole("region", { name: /^Used materials/ });
    await expect(panel).toContainText("“only the sound of the rain, for the opening”");

    // Back again: a listed option replaces the note.
    await page.getByRole("button", { name: /^Working Set:/ }).click();
    await sheet.getByRole("checkbox", { name: /^Select Rain on the platform roof/ }).click();
    await sheet.getByRole("button", { name: /Use this/ }).click();
    await ways.getByRole("radio", { name: /Follow its shape/ }).click();
    await how.getByRole("button", { name: /Use it/ }).click();
    await expect(panel).toContainText("Its shape");
    await page.reload();
    await expect(page.getByRole("region", { name: /^Used materials/ })).toContainText("Its shape");
  });
  test("choosing a use makes it happen — writing: words go into the draft; a tone becomes a CreativeMind revision", async ({ page }) => {
    const tag = uid();
    const a = await saveNote(page, `The chai seller's radio ${tag}\nOld film songs, half heard.`);
    const art = (await (await page.request.post("/api/v1/artifacts", { data: { artifactType: "poem", title: `Platform ${tag}`, content: "Every Sunday my father waited." } })).json()).artifact as {
      id: string;
    };
    const { workingSet } = (await (await page.request.post("/api/v1/studio-sessions", { data: { artifactId: art.id } })).json()) as { workingSet: { sessionId: string } };
    await page.request.post(`/api/v1/studio-sessions/${workingSet.sessionId}/sources`, { data: { items: [{ type: "material", id: a }] } });
    await page.goto(`/artifacts/${art.id}/studio`);
    const sheet = page.getByRole("dialog", { name: "Working Set" });
    const how = page.getByRole("dialog", { name: "How do you want to use this?" });

    // A tone steers: CreativeMind proposes a revision from the source (offline: a labelled placeholder) to keep or discard.
    await page.getByRole("button", { name: /^Working Set:/ }).click();
    await sheet.getByRole("checkbox", { name: /^Select The chai seller/ }).click();
    await sheet.getByRole("button", { name: /Use this/ }).click();
    await how.getByRole("radio", { name: /Take its tone and voice/ }).click();
    await how.getByRole("button", { name: /Use it/ }).click();
    await expect(page.getByRole("button", { name: "Keep revision" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("status").filter({ hasText: /CreativeMind is working/ })).toBeVisible();
    await page.getByRole("button", { name: "Discard" }).click();

    // Its words go straight into the draft.
    await page.getByRole("button", { name: /^Working Set:/ }).click();
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

    await page.goto(`/artifacts/${id}/studio`);
    const editor = page.getByRole("region", { name: "Editor" });
    const sheet = page.getByRole("dialog", { name: "Working Set" });
    const how = page.getByRole("dialog", { name: "How do you want to use this?" });
    await page.getByRole("button", { name: /^Working Set:/ }).click();
    await sheet.getByRole("checkbox", { name: new RegExp(`^Select ${name}`) }).click();
    await sheet.getByRole("button", { name: /Use this/ }).click();
    await expect(how.getByRole("radio", { name: /Use it as a slide image/ })).toHaveAttribute("aria-checked", "true");
    await how.getByRole("button", { name: /Use it/ }).click();
    // Offered, not replaced: the slide shows it with Keep current / Use new.
    const choice = editor.getByRole("region", { name: "New image for this slide" });
    await expect(choice).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole("status").filter({ hasText: "Your photo is on the slide" })).toBeVisible();
    await choice.getByRole("button", { name: "Use new" }).click();
    await expect(choice).toHaveCount(0);

    // Words onto the slide on screen.
    await page.getByRole("button", { name: /^Working Set:/ }).click();
    await sheet.getByRole("checkbox", { name: /^Select Lamps and steam/ }).click();
    await sheet.getByRole("button", { name: /Use this/ }).click();
    await how.getByRole("radio", { name: /Put its words on this slide/ }).click();
    await how.getByRole("button", { name: /Use it/ }).click();
    await expect(editor.getByRole("link", { name: /^Edit slide 1 of 2: Lamps and steam/ })).toBeVisible({ timeout: 15_000 });
  });
});
